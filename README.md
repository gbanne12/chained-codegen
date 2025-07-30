# Overview

This project is a fork of the [Playwright](https://playwright.dev/) test tool.

**Original Project**: [Microsoft Playwright](https://github.com/microsoft/playwright)  

The aim is to tweak the codegen tool from a great learning instrument into a useable tool for day to day usage. 

![Demo](./chained-locators.png)

# License
This project maintains the same Apache 2.0 license as the original Microsoft Playwright project. See LICENSE for details.

## Acknowledgments
All the hard work is done by the [Playwright](https://github.com/microsoft/playwright) team at Microsoft. We're grateful for their open-source contribution to the testing community.


# Changes

## Chained Locators
The recorder will prefer chaining locators together to identify a particular element within a section of the page. Avoid collisions with other similar named elements when dealing with multiple menus or grids

``` typescript 
await page
.getByRole('main')
.getByRole('article')
.getByRole('link', { name: 'How to install Playwright' })
.click();

```


## Polling Until Element Removal
Automatically waits for elements to be removed from the DOM. Wait for spinners, modals, or dynamic elements to disappear

``` typescript 
await expect(page.getByRole('dialog')).toHaveCount(0);
```



## Waiting Until Element Is Clickable
Use the built in actionability checks with a trial click before performing the next actions. 
The actionability checks will automatically be performed on the next action. However, sometimes theat element may be ready but the page will still be loading asynchronously.  Wait for a specific element to be ready before proceeding. 

``` typescript 
await page.getByRole('main').getByRole('article').click({ trial: true });
```


## Waiting Until Element Is Focused
Ensure the element is not just displayed but is now focused and ready to be used.

``` typescript 
await expect(page.getByRole('dialog')).toBeFocused();
```


## Assert Attribute
Ensures UI elements have correct classes, states, or properties

``` typescript 
await expect(page.getByRole('listitem').getByRole('link', { name: 'Release notes' })).toHaveAttribute('class', 'menu__link');
```

 ## Editable text grid
The generated code can be edited and lines can be moved up or down. When using poll until removed the action will have to be generated while the element remains.  It can then be moved down a line to after the removing action.  


# Getting Started
Install the package from npm

`npm install chained-codegen`

Then install the playwright browser binaries (e.g. for Chrome)

`npm chained codegen install chrome`

Finally, start the recorder 

`npm chained-codegen start` 


