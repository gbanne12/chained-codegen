# Overview

This project aims to tweak Playwright’s code generation tool to better resemble the final output for test scripts.

![Demo](./chained-locators.png)

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
Clone the repository.
Install dependencies:

`npm install`
`npm playwright install --with-deps`
`npm playwright codegen` 
Will run the Playwright codegen as usual with the functionality described above


License
See LICENSE for details.