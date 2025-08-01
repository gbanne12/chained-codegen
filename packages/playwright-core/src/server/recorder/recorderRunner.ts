/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { serializeExpectedTextValues } from '../../utils';
import { toKeyboardModifiers } from '../codegen/language';
import { serverSideCallMetadata } from '../instrumentation';
import { buildFullSelector, mainFrameForAction } from './recorderUtils';

import type { Page } from '../page';
import type * as types from '../types';
import type * as actions from '@recorder/actions';

export async function performAction(pageAliases: Map<Page, string>, actionInContext: actions.ActionInContext) {
  const callMetadata = serverSideCallMetadata();
  const mainFrame = mainFrameForAction(pageAliases, actionInContext);
  const { action } = actionInContext;

  const kActionTimeout = 5000;

  if (action.name === 'navigate') {
    await mainFrame.goto(callMetadata, action.url, { timeout: kActionTimeout });
    return;
  }

  if (action.name === 'openPage')
    throw Error('Not reached');

  if (action.name === 'closePage') {
    await mainFrame._page.close(callMetadata);
    return;
  }

  const selector = buildFullSelector(actionInContext.frame.framePath, action.selector);

  if (action.name === 'click') {
    const options = toClickOptions(action);
    await mainFrame.click(callMetadata, selector, { ...options, timeout: kActionTimeout, strict: true });
    return;
  }

  if (action.name === 'press') {
    const modifiers = toKeyboardModifiers(action.modifiers);
    const shortcut = [...modifiers, action.key].join('+');
    await mainFrame.press(callMetadata, selector, shortcut, { timeout: kActionTimeout, strict: true });
    return;
  }

  if (action.name === 'fill') {
    await mainFrame.fill(callMetadata, selector, action.text, { timeout: kActionTimeout, strict: true });
    return;
  }

  if (action.name === 'setInputFiles') {
    await mainFrame.setInputFiles(callMetadata, selector, { selector, payloads: [], timeout: kActionTimeout, strict: true });
    return;
  }

  if (action.name === 'check') {
    await mainFrame.check(callMetadata, selector, { timeout: kActionTimeout, strict: true });
    return;
  }

  if (action.name === 'uncheck') {
    await mainFrame.uncheck(callMetadata, selector, { timeout: kActionTimeout, strict: true });
    return;
  }

  if (action.name === 'select') {
    const values = action.options.map(value => ({ value }));
    await mainFrame.selectOption(callMetadata, selector, [], values, { timeout: kActionTimeout, strict: true });
    return;
  }

  if (action.name === 'assertChecked') {
    await mainFrame.expect(callMetadata, selector, {
      selector,
      expression: 'to.be.checked',
      expectedValue: { checked: action.checked },
      isNot: !action.checked,
      timeout: kActionTimeout,
    });
    return;
  }

  if (action.name === 'assertText') {
    await mainFrame.expect(callMetadata, selector, {
      selector,
      expression: 'to.have.text',
      expectedText: serializeExpectedTextValues([action.text], { matchSubstring: true, normalizeWhiteSpace: true }),
      isNot: false,
      timeout: kActionTimeout,
    });
    return;
  }

  if (action.name === 'assertValue') {
    await mainFrame.expect(callMetadata, selector, {
      selector,
      expression: 'to.have.value',
      expectedValue: action.value,
      isNot: false,
      timeout: kActionTimeout,
    });
    return;
  }

  if (action.name === 'assertVisible') {
    await mainFrame.expect(callMetadata, selector, {
      selector,
      expression: 'to.be.visible',
      isNot: false,
      timeout: kActionTimeout,
    });
    return;
  }

  if (action.name === 'assertClickable') {
    await mainFrame.click(callMetadata, selector, {
      trial: true,
      timeout: kActionTimeout,
    });
    return;
  }

  if (action.name === 'assertDetached') {
    await mainFrame.expect(callMetadata, selector, {
      selector,
      expression: 'to.have.count',
      expectedNumber: 0,
      isNot: false,
      timeout: kActionTimeout,
    });
    return;
  }

  if (action.name === 'assertFocus') {
    await mainFrame.expect(callMetadata, selector, {
      selector,
      expression: 'to.be.focused',
      isNot: false,
      timeout: kActionTimeout,
    });
    return;
  }

  if (action.name === 'assertAttribute') {
    await mainFrame.expect(callMetadata, selector, {
      selector,
      expression: 'to.have.attribute',
      expectedValue: { name: action.attribute, value: action.value },
      isNot: false,
      timeout: kActionTimeout,
    });
    return;
  }

  throw new Error('Internal error: unexpected action ' + (action as any).name);
}

export function toClickOptions(action: actions.ClickAction): types.MouseClickOptions {
  const modifiers = toKeyboardModifiers(action.modifiers);
  const options: types.MouseClickOptions = {};
  if (action.button !== 'left')
    options.button = action.button;
  if (modifiers.length)
    options.modifiers = modifiers;
  if (action.clickCount > 1)
    options.clickCount = action.clickCount;
  if (action.position)
    options.position = action.position;
  return options;
}
