# Convivial Decision Flow

A JavaScript library for creating interactive convivial decision flows.

## Overview

The Convivial Decision Flow library allows you to create dynamic, interactive decision flows on your web pages. Users can navigate through a series of steps based on their choices, with the ability to store progress and display summaries of their selections.

## Features

- **Interactive Steps**: Guide users through a series of steps with clickable answers.
- **Form Handling**: Collect user input through forms and navigate based on their responses.
- **Storage Options**: Save user progress in local or session storage to maintain state across sessions.
- **Dynamic Filtering**: Show or hide content based on user input using custom filters.
- **Summary Display**: Automatically generate and display a summary of user choices at the end.
- **Back and Restart Navigation**: Allow users to navigate backward and restart the decision flow.
- **Custom Function Execution**: Define and execute custom functions securely from storage.

## New Features

### Storage Options

The library now supports both local and session storage for saving user progress. You can choose the type of storage by specifying it when initializing the `ConvivialDecisionFlow` instance.

### Custom Function Execution

You can now define and store custom functions in the selected storage. These functions can be executed securely using the `data-df-show` attribute. This feature helps in extending the functionality of the decision flow dynamically.

### Form Handling

The library supports handling form submissions within the decision flow. Forms can collect user input and navigate to the next step based on the form's action attribute.

### Dynamic Filtering

You can use data attributes to dynamically show or hide content based on user input. The supported filter criteria include:

- **Variable Comparison**: Compare stored variables against specified values.
  - Example: `data-df-filter="var_age_gte_18"` (Shows content if age is greater than or equal to 18)
- **Step History**: Show content based on previously visited steps.
  - Example: `data-df-filter="visited_step-id"` (Shows content if a specific step was visited)

### Summarization

Automatically generate summaries of user choices and display them in a designated section. The summary includes:

- **Summary of Choices**: A list of all the user's choices throughout the decision flow.
- **History**: Display the steps the user has taken.
- **Submission Data**: Show collected form data.

### Example of Summary Divs

At the end of the decision flow, you can include divs to show a summary of user choices, the history of steps taken, and submission data. This can be configured in the HTML structure:

```html
<div class="step" id="summary">
  <h3>Summary</h3>
  <div class="convivial-decision-flow__history"></div>
  <div class="convivial-decision-flow__submission"></div>
</div>
```

### Complex Conditions

You can define complex conditions in your decision flow using `data-df-filter` attributes. The following examples illustrate how to use AND (`+`) and OR (`,`):

- **Logical AND**: All conditions must be true.
  ```html
  <div data-df-filter="var_age_gte_18+var_nationality_eq_japanese">
    Content for Japanese users aged 18 or older.
  </div>
  ```

- **Logical OR**: At least one condition must be true.
  ```html
  <div data-df-filter="var_age_gte_18,var_nationality_eq_japanese">
    Content for users aged 18 or older or Japanese users.
  </div>
  ```

- **Combination of AND and OR**:
  ```html
  <div data-df-filter="!var_nationality_eq_japanese+var_age_gte_18,var_nationality_eq_japanese+var_age_gte_20">
    Content for users who are either non-Japanese aged 18 or older, or Japanese aged 20 or older.
  </div>
  ```

### Security Enhancements

To ensure the safety and security of executing custom functions in the Convivial Decision Flow library, we have implemented several measures to prevent potential injection attacks and unauthorized code execution. Here's a detailed explanation of these enhancements and why our approach is safer than using `eval`.

#### Sanitizing Inputs

We ensure that any input used in the functions is sanitized to prevent injection attacks. This includes validating function names to ensure they are valid JavaScript identifiers.

#### Restricting Function Names

Function names are validated to match a specific pattern that ensures they are safe and valid. This prevents the execution of malicious code through crafted function names.

#### Using a Secure Context

Functions are executed within a secure context to limit potential exploits. We avoid using `eval`, which can execute arbitrary code and is a significant security risk.

### Why Our Approach is Safer Than Using `eval`

Using `eval` to execute dynamic code can lead to severe security vulnerabilities, as it allows execution of arbitrary code, which can be exploited by attackers. Our approach avoids these risks by:

1. **Validating Function Names**: Ensuring that function names are valid JavaScript identifiers prevents the execution of unintended code.
2. **Executing in a Controlled Context**: By defining and executing functions within a controlled context, we limit the scope of what can be executed.
3. **Avoiding Arbitrary Code Execution**: Unlike `eval`, which can execute any string as JavaScript code, our method only allows predefined and validated functions to be executed.

### Updated Methods

#### Define Function Method

We validate function names to ensure they are valid identifiers:

```javascript
defineFunction(type, name, fn) {
  if (typeof fn !== 'function') {
    throw new Error('Provided argument is not a function');
  }
  if (!this.functions[type]) {
    this.functions[type] = {};
  }

  // Ensure the function name is a valid identifier
  const validName = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(name);
  if (!validName) {
    throw new Error('Invalid function name');
  }

  this.functions[type][name] = fn;
  console.log(`Defined function "${name}" under type "${type}"`);
}
```

#### Execute Function Method

We validate that the function name is safe to use before executing:

```javascript
executeFunction(type, name, el, args = []) {
  if (!this.functions[type] || !this.functions[type][name]) {
    throw new Error(`Function "${name}" not found in ${type}`);
  }

  // Validate that the function name is safe to use
  const validName = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(name);
  if (!validName) {
    throw new Error('Invalid function name');
  }

  try {
    return this.functions[type][name](this, el, ...args);
  } catch (e) {
    console.error(`Error executing function "${name}":`, e);
    throw e;
  }
}
```

#### Initialize Custom Function Calls Method

We validate function names before adding event listeners:

```javascript
_initializeFunctionCalls() {
  document.querySelectorAll(`#${this.config.id} [data-df-show]`).forEach((element) => {
    const functionName = element.getAttribute('data-df-show');
    if (functionName) {
      // Validate the function name
      const validName = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(functionName);
      if (validName) {
        console.log(`Executing show function: ${functionName}`);
        this.executeFunction('show', functionName, element);
      } else {
        console.warn(`Invalid function name: ${functionName}`);
      }
    }
  });

  document.querySelectorAll(`#${this.config.id} [data-df-show]`).forEach((element) => {
    const functionName = element.getAttribute('data-df-show');
    if (functionName) {
      // Validate the function name
      const validName = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(functionName);
      if (validName) {
        console.log(`Adding event listener for content function: ${functionName}`);

        // Use a data attribute to track if the event listener has already been added
        if (!element.hasAttribute('data-listener-added')) {
          element.addEventListener('click', () => {
            console.log(`Executing content function: ${functionName}`);
            this.executeFunction('content', functionName, element);
          });

          // Mark this element as having the listener added
          element.setAttribute('data-listener-added', 'true');
        }
      } else {
        console.warn(`Invalid function name: ${functionName}`);
      }
    }
  });
}
```

By implementing these security measures, we ensure that the Convivial Decision Flow library provides a secure environment for defining and executing custom functions, significantly reducing the risk of security vulnerabilities.

## Getting Started

### Load the Required Files

To use the Convivial Decision Flow library, you need to include both the JavaScript and CSS files in your HTML:

```html
<link rel="stylesheet" type="text/css" href="path/to/style.min.css">
<script type="text/javascript" src="path/to/convivial_decision_flow.min.js" defer></script>
```

### HTML Structure

Create your decision flow using a series of nested `div` elements. Each `div` with the class `step` represents a step in the decision flow. Use `data-df-filter` attributes to conditionally display content.

```html
<div class="convivial-decision-flow" id="example-flow">
  <div class="step" id="step-1">
    <h3>Welcome</h3>
    <form class="df-form" action="#step-2">
      <label for="age">Enter your age:</label>
      <input type="number" name="age" required>
      <input type="submit" value="Next">
    </form>
  </div>

  <div class="step" id="step-2">
    <h3>Choose your preference</h3>
    <ul>
      <li><a class="step__answer" href="#step-3" data-answer-path="option1">Option 1</a></li>
      <li><a class="step__answer" href="#step-4" data-answer-path="option2">Option 2</a></li>
    </ul>
  </div>

  <div class="step" id="step-3">
    <h3>Option 1</h3>
    <p>You selected Option 1.</p>
  </div>

  <div class="step" id="step-4">
    <h3>Option 2</h3>
    <p>You selected Option 2.</p>
  </div>

  <div class="step" id="summary">
    <h3>Summary</h3>
    <div data-df-show="history"></div>
    <div data-df-show="submission"></div>
  </div>

  <div class="convivial-decision-flow__footer">
    <button class="btn btn-secondary step__button step__button--back">Back</button>
    <button class="btn btn-secondary step__button step__button--restart">Restart</button>
  </div>
</div>
```

### JavaScript Initialization

The library automatically initializes all decision flows on the page when the DOM content is loaded:

```html
<script>
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.convivial-decision-flow').forEach(function (flow) {
    if (flow.id) {
      new ConvivialDecisionFlow(localStorage, flow.id, flow); // Modify as needed to use 'sessionStorage' or 'localStorage'
    } else {
      console.warn('Convivial decision flow does not have an ID.');
    }
  });
});
</script>
```

### Define and Execute Custom Functions

You can define and store custom functions in the `functions` property map and execute them securely. Here's how:

1. Define a function in the JavaScript:

```javascript
document.addEventListener('DOMContentLoaded', function () {
  const dt = new ConvivialDecisionFlow(localStorage, 'example-flow', document.getElementById('example-flow'));
  dt.functions.content['updateTextFunction'] = function (context, el) {
    document.getElementById('custom-text').textContent = 'Updated text';
  };
});
```

2. Execute the function using the `data-df-show` attribute:

```html
<button data-df-show="updateTextFunction">Update Text</button>
```

## How to Compress the JS File

To compress the `convivial_decision_flow.js` file, follow these steps:

1. Install the `uglify-js` package:

```bash
npm install -g uglify-js
```

2. Use the following command to compress the file:

```bash
uglifyjs convivial_decision_flow.js -o convivial_decision_flow.min.js
```

## How to Create a Release

To create a release, update the version number in your `package.json` file and use the following command:

```bash
npm version [patch|minor|major]
```

For more details, refer to the [npm documentation](https://docs.npmjs.com/updating-your-published-package-version-number).

## Example Use Case

Here's an example of how you can use the decision flow in a web page:

```html
<!DOCTYPE html>
<html lang="en-US">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Convivial Decision Flow Example</title>
  <link rel="stylesheet" type="text/css" href="style.min.css">
  <script type="text/javascript" src="convivial_decision_flow.min.js" defer></script>
</head>
<body>
  <h1>Example Convivial Decision Flow</h1>
  <div class="convivial-decision-flow" id="example-flow">
    <!-- Steps here -->
  </div>
</body>
</html>
```

By following the above guide, you can effectively utilize the Convivial Decision Flow library to create interactive decision-making experiences on your website.
