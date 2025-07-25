/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import type { CallLog, ElementInfo, Mode, Source } from './recorderTypes';
import { CodeMirrorWrapper } from '@web/components/codeMirrorWrapper';
import type { SourceHighlight } from '@web/components/codeMirrorWrapper';
import { SplitView } from '@web/components/splitView';
import { TabbedPane } from '@web/components/tabbedPane';
import { Toolbar } from '@web/components/toolbar';
import { emptySource, SourceChooser } from '@web/components/sourceChooser';
import { ToolbarButton, ToolbarSeparator } from '@web/components/toolbarButton';
import * as React from 'react';
import { CallLogView } from './callLog';
import './recorder.css';
import { asLocator } from '@isomorphic/locatorGenerators';
import { toggleTheme } from '@web/theme';
import { copy, useSetting } from '@web/uiUtils';
import yaml from 'yaml';
import { parseAriaSnapshot } from '@isomorphic/ariaSnapshot';

export interface RecorderProps {
  sources: Source[],
  paused: boolean,
  log: Map<string, CallLog>,
  mode: Mode,
}

export const Recorder: React.FC<RecorderProps> = ({
  sources,
  paused,
  log,
  mode,
}) => {
  const [selectedFileId, setSelectedFileId] = React.useState<string | undefined>();
  const [runningFileId, setRunningFileId] = React.useState<string | undefined>();
  const [selectedTab, setSelectedTab] = useSetting<string>('recorderPropertiesTab', 'log');
  const [ariaSnapshot, setAriaSnapshot] = React.useState<string | undefined>();
  const [ariaSnapshotErrors, setAriaSnapshotErrors] = React.useState<SourceHighlight[]>();
  const [currentLine, setCurrentLine] = React.useState<number>(0);
  const [sourceText, setSourceText] = React.useState<string>('');

  const fileId = selectedFileId || runningFileId || sources[0]?.id;

  const source = React.useMemo(() => {
    if (fileId) {
      const source = sources.find(s => s.id === fileId);
      if (source)
        return source;
    }
    return emptySource();
  }, [sources, fileId]);

  const [locator, setLocator] = React.useState('');
  const [allSelectors, setAllSelectors] = React.useState<string[]>([]);
  const [currentSelectorIndex, setCurrentSelectorIndex] = React.useState(0);
  
  window.playwrightElementPicked = (elementInfo: ElementInfo, userGesture?: boolean) => {
    const language = source.language;
    setLocator(asLocator(language, elementInfo.selector));
    
    // Handle multiple selectors
    if (elementInfo.selectors && elementInfo.selectors.length > 1) {
      setAllSelectors(elementInfo.selectors.map(s => asLocator(language, s)));
      setCurrentSelectorIndex(elementInfo.currentSelectorIndex || 0);
    } else {
      setAllSelectors([]);
      setCurrentSelectorIndex(0);
    }
    
    setAriaSnapshot(elementInfo.ariaSnapshot);
    setAriaSnapshotErrors([]);
    if (userGesture && selectedTab !== 'locator' && selectedTab !== 'aria')
      setSelectedTab('locator');

    if (mode === 'inspecting' && selectedTab === 'aria') {
      // Keep exploring aria.
    } else {
      window.dispatch({ event: 'setMode', params: { mode: mode === 'inspecting' ? 'standby' : 'recording' } }).catch(() => { });
    }
  };

  window.playwrightSetRunningFile = setRunningFileId;

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, [messagesEndRef]);


  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'F8':
          event.preventDefault();
          if (paused)
            window.dispatch({ event: 'resume' });
          else
            window.dispatch({ event: 'pause' });
          break;
        case 'F10':
          event.preventDefault();
          if (paused)
            window.dispatch({ event: 'step' });
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [paused]);

  const onEditorChange = React.useCallback((selector: string) => {
    if (mode === 'none' || mode === 'inspecting')
      window.dispatch({ event: 'setMode', params: { mode: 'standby' } });
    setLocator(selector);
    window.dispatch({ event: 'highlightRequested', params: { selector } });
  }, [mode]);

  const cycleToNextLocator = React.useCallback(() => {
    if (allSelectors.length <= 1) return;
    
    const nextIndex = (currentSelectorIndex + 1) % allSelectors.length;
    setCurrentSelectorIndex(nextIndex);
    const nextLocator = allSelectors[nextIndex];
    setLocator(nextLocator);
    
    // Update the highlight and send the new selector
    window.dispatch({ event: 'highlightRequested', params: { selector: nextLocator } });
    
    // Trigger cycling in the injected recorder
    window.dispatch({ event: 'cycleLocator', params: { direction: 'next' } }).catch(() => { });
  }, [allSelectors, currentSelectorIndex]);

  const onAriaEditorChange = React.useCallback((ariaSnapshot: string) => {
    if (mode === 'none' || mode === 'inspecting')
      window.dispatch({ event: 'setMode', params: { mode: 'standby' } });
    const { fragment, errors } = parseAriaSnapshot(yaml, ariaSnapshot, { prettyErrors: false });
    const highlights = errors.map(error => {
      const highlight: SourceHighlight = {
        message: error.message,
        line: error.range[1].line,
        column: error.range[1].col,
        type: 'subtle-error',
      };
      return highlight;
    });
    setAriaSnapshotErrors(highlights);
    setAriaSnapshot(ariaSnapshot);
    if (!errors.length)
      window.dispatch({ event: 'highlightRequested', params: { ariaTemplate: fragment } });
  }, [mode]);

  // Sync source text state
  React.useEffect(() => {
    setSourceText(source.text);
  }, [source.text]); const moveLineUp = React.useCallback(() => {
    if (currentLine <= 0)
      return;
    const lines = sourceText.split('\n');
    if (currentLine >= lines.length)
      return;

    // Swap current line with the one above
    const temp = lines[currentLine];
    lines[currentLine] = lines[currentLine - 1];
    lines[currentLine - 1] = temp;
    const newText = lines.join('\n');
    setSourceText(newText);
    setCurrentLine(currentLine - 1);
    // Note: This only updates the UI, not the underlying actions
    // In a future enhancement, we could map line changes back to action rearrangement
  }, [currentLine, sourceText]);

  const moveLineDown = React.useCallback(() => {
    const lines = sourceText.split('\n');
    if (currentLine >= lines.length - 1)
      return;
    // Swap current line with the one below
    const temp = lines[currentLine];
    lines[currentLine] = lines[currentLine + 1];
    lines[currentLine + 1] = temp;
    const newText = lines.join('\n');
    setSourceText(newText);
    setCurrentLine(currentLine + 1);
    // Note: This only updates the UI, not the underlying actions
    // In a future enhancement, we could map line changes back to action rearrangement
  }, [currentLine, sourceText]);

  const onCursorChange = React.useCallback((line: number) => {
    setCurrentLine(line);
  }, []);

  const onSourceChange = React.useCallback((text: string) => {
    setSourceText(text);
    // Note: This only updates the UI, not the underlying actions
    // In a future enhancement, we could map changes back to action modifications
  }, []);

  // Add keyboard shortcuts for moving lines
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp':
          if (event.altKey) {
            event.preventDefault();
            moveLineUp();
          }
          break;
        case 'ArrowDown':
          if (event.altKey) {
            event.preventDefault();
            moveLineDown();
          }
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [moveLineUp, moveLineDown]);

  return <div className='recorder'>
    <Toolbar>
      <ToolbarButton icon='circle-large-filled' title='Record' toggled={mode === 'recording' || mode === 'recording-inspecting' || mode === 'assertingText' || mode === 'assertingVisibility' || mode === 'assertingValue' || mode === 'assertingSnapshot' || mode === 'assertingClickable' || mode === 'assertingDetached' || mode === 'assertingFocus' || mode === 'assertingAttribute'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'none' || mode === 'standby' || mode === 'inspecting' ? 'recording' : 'standby' } });
      }}>Record</ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton icon='inspect' title='Pick locator' toggled={mode === 'inspecting' || mode === 'recording-inspecting'} onClick={() => {
        const newMode = {
          'inspecting': 'standby',
          'none': 'inspecting',
          'standby': 'inspecting',
          'recording': 'recording-inspecting',
          'recording-inspecting': 'recording',
          'assertingText': 'recording-inspecting',
          'assertingVisibility': 'recording-inspecting',
          'assertingValue': 'recording-inspecting',
          'assertingSnapshot': 'recording-inspecting',
          'assertingClickable': 'recording-inspecting',
          'assertingDetached': 'recording-inspecting',
          'assertingFocus': 'recording-inspecting',
          'assertingAttribute': 'recording-inspecting',
        }[mode];
        window.dispatch({ event: 'setMode', params: { mode: newMode } }).catch(() => { });
      }}></ToolbarButton>
      <ToolbarButton icon='eye' title='Assert visibility' toggled={mode === 'assertingVisibility'} disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'assertingVisibility' ? 'recording' : 'assertingVisibility' } });
      }}></ToolbarButton>
      <ToolbarButton icon='whole-word' title='Assert text' toggled={mode === 'assertingText'} disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'assertingText' ? 'recording' : 'assertingText' } });
      }}></ToolbarButton>
      <ToolbarButton icon='symbol-constant' title='Assert value' toggled={mode === 'assertingValue'} disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'assertingValue' ? 'recording' : 'assertingValue' } });
      }}></ToolbarButton>
      <ToolbarButton icon='gist' title='Assert snapshot' toggled={mode === 'assertingSnapshot'} disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'assertingSnapshot' ? 'recording' : 'assertingSnapshot' } });
      }}></ToolbarButton>
      <ToolbarButton icon='tag' title='Assert attribute' toggled={mode === 'assertingAttribute'} disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'assertingAttribute' ? 'recording' : 'assertingAttribute' } });
      }}></ToolbarButton>
      <ToolbarButton icon='target' title='Assert focused' toggled={mode === 'assertingFocus'} disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'assertingFocus' ? 'recording' : 'assertingFocus' } });
      }}></ToolbarButton>

      <ToolbarSeparator />
      <ToolbarButton icon='search' title='Poll until clickable' toggled={mode === 'assertingClickable'} disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'assertingClickable' ? 'recording' : 'assertingClickable' } });
      }}></ToolbarButton>
      <ToolbarButton icon='search-stop' title='Poll until removed' toggled={mode === 'assertingDetached'} disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'assertingDetached' ? 'recording' : 'assertingDetached' } });
      }}></ToolbarButton>
      <ToolbarSeparator>

      </ToolbarSeparator>
      <ToolbarButton icon='files' title='Copy' disabled={!source || !source.text} onClick={() => {
        copy(source.text);
      }}></ToolbarButton>
      <ToolbarButton icon='arrow-up' title='Move line up' disabled={!source || !source.text || currentLine <= 0} onClick={moveLineUp}></ToolbarButton>
      <ToolbarButton icon='arrow-down' title='Move line down' disabled={!source || !source.text || currentLine >= sourceText.split('\n').length - 1} onClick={moveLineDown}></ToolbarButton>
      <ToolbarButton icon='debug-continue' title='Resume (F8)' ariaLabel='Resume' disabled={!paused} onClick={() => {
        window.dispatch({ event: 'resume' });
      }}></ToolbarButton>
      <ToolbarButton icon='debug-pause' title='Pause (F8)' ariaLabel='Pause' disabled={paused} onClick={() => {
        window.dispatch({ event: 'pause' });
      }}></ToolbarButton>
      <ToolbarButton icon='debug-step-over' title='Step over (F10)' ariaLabel='Step over' disabled={!paused} onClick={() => {
        window.dispatch({ event: 'step' });
      }}></ToolbarButton>
      <div style={{ flex: 'auto' }}></div>
      <div>Target:</div>
      <SourceChooser fileId={fileId} sources={sources} setFileId={fileId => {
        setSelectedFileId(fileId);
        window.dispatch({ event: 'fileChanged', params: { file: fileId } });
      }} />
      <ToolbarButton icon='clear-all' title='Clear' disabled={!source || !source.text} onClick={() => {
        window.dispatch({ event: 'clear' });
      }}></ToolbarButton>
      <ToolbarButton icon='color-mode' title='Toggle color mode' toggled={false} onClick={() => toggleTheme()}></ToolbarButton>
    </Toolbar>
    <SplitView
      sidebarSize={200}
      main={<CodeMirrorWrapper text={sourceText} language={source.language} highlight={source.highlight} revealLine={source.revealLine} readOnly={false} lineNumbers={true} onChange={onSourceChange} onCursorChange={onCursorChange} />}
      sidebar={<TabbedPane
        rightToolbar={selectedTab === 'locator' || selectedTab === 'aria' ? [
          ...(selectedTab === 'locator' && allSelectors.length > 1 ? [
            <ToolbarButton
              key='cycle'
              icon='arrow-right'
              title={`Cycle locator (${currentSelectorIndex + 1}/${allSelectors.length})`}
              onClick={cycleToNextLocator}
            />
          ] : []),
          <ToolbarButton key={1} icon='files' title='Copy' onClick={() => copy((selectedTab === 'locator' ? locator : ariaSnapshot) || '')} />
        ] : []}
        tabs={[
          {
            id: 'locator',
            title: 'Locator',
            render: () => <CodeMirrorWrapper text={locator} placeholder='Type locator to inspect' language={source.language} focusOnChange={true} onChange={onEditorChange} wrapLines={true} />
          },
          {
            id: 'log',
            title: 'Log',
            render: () => <CallLogView language={source.language} log={Array.from(log.values())} />
          },
          {
            id: 'aria',
            title: 'Aria',
            render: () => <CodeMirrorWrapper text={ariaSnapshot || ''} placeholder='Type aria template to match' language={'yaml'} onChange={onAriaEditorChange} highlight={ariaSnapshotErrors} wrapLines={true} />
          },
        ]}
        selectedTab={selectedTab}
        setSelectedTab={setSelectedTab}
      />}
    />
  </div>;
};
