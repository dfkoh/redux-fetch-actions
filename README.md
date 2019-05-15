# Redux Fetch Actions

Fetches using standardized, four-part asynchronous actions for redux-thunk.
Based on [fetch-action-creator](https://github.com/CharlesStover/fetch-action-creator).

Dispatch a single, asynchronous action that fetches a request, and your redux
store will receive corresponding actions when your fetch API (1) requests, (2)
resolves a response, (3) rejects an error, and/or (4) is aborted.

[![version](https://img.shields.io/npm/v/redux-fetch-wrapper.svg)](https://www.npmjs.com/package/redux-fetch-wrapper)
[![minified size](https://img.shields.io/bundlephobia/min/redux-fetch-wrapper.svg)](https://www.npmjs.com/package/redux-fetch-wrapper)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/redux-fetch-wrapper.svg)](https://www.npmjs.com/package/redux-fetch-wrapper)
[![downloads](https://img.shields.io/npm/dt/redux-fetch-wrapper.svg)](https://www.npmjs.com/package/redux-fetch-wrapper)
[![build](https://travis-ci.com/dfkoh/redux-fetch-wrapper.svg)](https://travis-ci.com/dfkoh/redux-fetch-wrapper/)

## Install

* `npm install redux-fetch-wrapper --save` or
* `yarn add redux-fetch-wrapper`

Your redux store must be using the `redux-thunk` middleware.

## Basic Example

```JS
import {makeFetchActions, fetchActionTypes} from 'redux-fetch-wrapper';

const EMPLOYEES = fetchActionTypes('EMPLOYEES');
const fetchEmployees = () =>
  makeFetchActions(

    // Included in the action types received by your redux store.
    'EMPLOYEES',

    // URL to fetch.
    'https://my.business.com/employees.json'
  );
```
The above example will send a `EMPLOYEES_REQUEST` action to the redux store,
followed by one of the following: `EMPLOYEES_ABORT` if the request was aborted,
`EMPLOYEES_REJECT` if an error occurred, or `EMPLOYEES_RESOLVE` if the data was
received successfully. These action names are also accessible from the 
`EMPLOYEES` object created by fetchActionTypes, e.g. `EMPLOYEES.REQUEST`.

See the documentation for a list of action properties.

## Advanced Example
```JS
import {makeFetchActions} from 'redux-fetch-wrapper';

// We want to include an employee's name in the fetch request.
const [ADD_EMPLOYEE, fetchAddEmployee] = name =>
  makeFetchActions(

    // Included in the action types received by your redux store.
    'ADD_EMPLOYEE',

    // URL to fetch.
    'https://my.business.com/employees.json',

    // Fetch options are configurable.
    {
      body: name,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      },
      method: 'POST'
    }

    // Action mutators can change the default actions sent to the redux reducers.
    {

      // An object mutator will EXTEND the default action sent to the redux reducer.
      // The abort action will now have a name property equal to the one passed to fetchAddEmployee.
      onAbort: { name }

      // The reject action will now have a name property equal to the one passed to fetchAddEmployee
      //    and a timestamp property equal to the time that the error occurred.
      onReject: {
        name,
        timestamp: Date.now()
      },

      // A function mutator will RECEIVE the default action sent and mutate it before passing it to the redux reducer.
      // The request action will now have a name property equal to the one passed to fetchAddEmployee.
      onRequest: requestAction => ({
        ...requestAction,
        name
      }),

      // The resolve action will now have a name property equal to the one passed to fetchAddEmployee
      //    and a timestamp property equal to the time that the error occurred.
      // You may mutate the action however you want.
      onResolve: resolveAction => {
        resolveAction.timestamp = Date.now();
        if (name.endsWith('*')) {
          resolveAction.type = 'RESOLVE_ADD_MANAGER';
        }
        return {
          ...resolveAction,
          name
        };
      }
    },

    // A conditional function will prevent the fetch request if it returns false.
    // The conditional function receives the current redux state as a parameter.
    state => {

      // If this request is already loading (handled in the reducer),
      //    don't make the same request again.
      if (state.employees[name].status === 'loading') {
        return false;
      }

      // People named Bob aren't allowed to work here.
      if (name === 'Bob') {
        return false;
      }

      // Allow the addition of anyone else.
      return true;
    }
  );
```

## Parameters

### id: string

An ID used to generate the types for each dispatched action.

_Example:_ An ID of `ADD_EMPLOYEE` will dispatch the actions `REQUEST_ADD_EMPLOYEE`, `RESOLVE_ADD_EMPLOYEE`, `REJECT_ADD_EMPLOYEE`, and `ABORT_ADD_EMPLOYEE`.

### url: string

The URL to which you are dispatching a fetch request.
  
_See also:_ [fetch parameters](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters) on MDN

### init: null | RequestInit | (state?: Object) => RequestInit

The fetch options which you are including in your fetch request _or_ a function that returns said options, taking the current state as a parameter.
  
_See also:_ [fetch parameters](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters) on MDN

_Default:_ Empty object.

### actions: Actions | null

An object of action mutators that will change the default actions that are dispatched to the redux reducers.

The keys of this object may be:

* `onAbort`, which is used when your fetch request is aborted
* `onReject`, which is used when your fetch request encountered an error
* `onRequest`, which is used when your fetch request has been initiated
* `onResolve`, which is used whe nyour fetch request has resolved successfully

The values of this object may be an object, which will be _merged_ with the default action.

```JS
{
  onAbort: { myKey: 'myValue' }
}
// creates
{
  myKey: 'myValue',
  type: 'ABORT_ID'
}
```

The values of this object may alternatively be a function, which will receive the default action and return a changed action.

```JS
{
  onAbort: abortAction => ({
    type: abortAction.type.split('').reverse().join('')
  })
}
// creates
{
  type: 'DI_TROBA'
}
```

#### Action properties

* `onAbort`

  * _no additional properties_

* `onReject`

  * `error` contains a string with the error message. This may be either a JavaScript error or server response.

  * `statusCode` contains an integer value of the response status code, e.g. `404`.

* `onRequest`
  
  * `body` contains the body of the request. This can be a JavaScript object or string.

* `onResolve`

  * `body` contains the body of the response. This can be a JavaScript object or string.

  * `headers` contains an instance of `Headers` with which the server responded to the request.

  * `statusCode` contains an integer value of the response status code, e.g. `200`.

### abortController: AbortController | null

`abortController` should be passed an [AbortController instance](https://developer.mozilla.org/en-US/docs/Web/API/AbortController). This instance will be connected to the fetch request when the request is made, and can be used to abort the request.

### conditional?: (state: Object) => boolean

If present, this function is called prior to the fetch request.

If it returns true, the fetch request will continue. If it returns false, the entire asynchronous action will be ignored.

The parameter of this function is a current snapshot of your redux state.
