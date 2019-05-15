const expect = require('chai').expect;
const fetchActionCreator = require('./fetch-action-creator');
require('abortcontroller-polyfill/dist/polyfill-patch-fetch');

const Response = function(status) {
  this.status = status;
};
Response.prototype.clone = function() {
  return this;
};
Response.prototype.json = () => {
  throw new Error('response.json() error');
};
Response.prototype.text = () => Promise.resolve('response.text()');

const ErrorResponse = function(status) {
  this.status = status;
};
ErrorResponse.prototype.clone = function() {
  return this;
};
ErrorResponse.prototype.json = () => new Promise((resolve, reject) => { 
  throw new Error('json parse error'); 
});
ErrorResponse.prototype.text = () => Promise.resolve('response.text()');

const fetchAsyncSuccess = (_, { signal }) => new Promise((resolve, reject) => {
  signal.addEventListener('abort', () => { reject(new Error()) });
  setTimeout(resolve, 1000);
});
const fetchError = () => Promise.reject(new Error('fetch error'));
const fetchError404 = () => Promise.resolve(new Response(404));
const fetchErrorJSON = () => Promise.resolve(new ErrorResponse(404));
const fetchSuccess = () => Promise.resolve(new Response(200));
const getEmptyState = () => Object.create(null);

const ID = 'TEST';
const INIT = { body: 'body' };
const URL = 'http://localhost/';

describe('fetchActionCreator', () => {

  it('should create a thunk action', () => {
    const action = fetchActionCreator(ID, URL, INIT);
    expect(action).to.be.a('function');
    expect(action.length).to.equal(2);
  });

  // REQUEST
  it('should dispatch a request action', async function() {
    global.fetch = fetchSuccess;
    const action = fetchActionCreator(ID, URL, INIT);
    let dispatchCalls = 0;
    const dispatch = ({ type }) => {
      dispatchCalls++;
      if (dispatchCalls === 1) {
        expect(type).to.equal('REQUEST_' + ID);
      }
    };
    await action(dispatch, getEmptyState);
    expect(dispatchCalls).to.equal(2);
  });

  // RESOLVE
  it('should dispatch a resolve action', async function() {
    global.fetch = fetchSuccess;
    const action = fetchActionCreator(ID, URL, INIT);
    let dispatchCalls = 0;
    const dispatch = ({ type }) => {
      dispatchCalls++;
      if (dispatchCalls === 2) {
        expect(type).to.equal('RESOLVE_' + ID);
      }
    };
    await action(dispatch, getEmptyState);
    expect(dispatchCalls).to.equal(2);
  });

  // REJECT (fetch)
  it('should dispatch a fetch reject action', async function() {
    global.fetch = fetchError;
    const action = fetchActionCreator(ID, URL, INIT);
    let dispatchCalls = 0;
    const dispatch = ({ type }) => {
      dispatchCalls++;
      if (dispatchCalls === 2) {
        expect(type).to.equal('REJECT_' + ID);
      }
    };
    await action(dispatch, getEmptyState);
    expect(dispatchCalls).to.equal(2);
  });

  // REJECT (server)
  it('should dispatch a server reject action', async function() {
    global.fetch = fetchError404;
    const action = fetchActionCreator(ID, URL, INIT);
    let dispatchCalls = 0;
    const dispatch = ({ type, statusCode }) => {
      dispatchCalls++;
      if (dispatchCalls === 2) {
        expect(type).to.equal('REJECT_' + ID);
      }
    };
    await action(dispatch, getEmptyState);
    expect(dispatchCalls).to.equal(2);
  });

  // REJECT (json parse error)
  it('should dispatch a server reject action even with json error', async function() {
    global.fetch = fetchErrorJSON;
    const action = fetchActionCreator(ID, URL, INIT);
    let dispatchCalls = 0;
    const dispatch = ({ type, statusCode }) => {
      dispatchCalls++;
      if (dispatchCalls === 2) {
        expect(type).to.equal('REJECT_' + ID);
        expect(statusCode).to.equal(404)
      }
    };
    await action(dispatch, getEmptyState);
    expect(dispatchCalls).to.equal(2);
  });

  // ABORT
  it('should dispatch an abort action', async function() {
    global.fetch = fetchAsyncSuccess;
    let called = false;
    let resolve = () => {};
    abortController = new AbortController();
    const abortPromise = new Promise((r) => {
      resolve = r;
    });
    const action = fetchActionCreator(ID, URL, INIT, null, abortController);
    let dispatchCalls = 0;
    const dispatch = (action) => {
      dispatchCalls++;
      if (action.type !== 'REQUEST_' + ID && action.type !== 'REJECT_' + ID) {
        expect(action.type).to.equal('ABORT_' + ID);
        expect(dispatchCalls).to.equal(2);
        called = true;
        resolve();
      }
    };
    action(dispatch, getEmptyState);
    abortController.abort();
    await abortPromise;
    expect(called).to.be.true;
  });

  // CONDITIONAL
  it('should respect the conditional', async function() {
    global.fetch = fetchSuccess;
    const action = fetchActionCreator(
      ID, URL, INIT, null, null,
      () => false
    );
    let dispatchCalls = 0;
    const dispatch = () => {
      dispatchCalls++;
    };
    await action(dispatch, getEmptyState);
    expect(dispatchCalls).to.equal(0);
  });

  it('should allow object action mutation', async function() {
    global.fetch = fetchSuccess;
    const action = fetchActionCreator(
      ID, URL, INIT, {
        onRequest: { test: 123 }
      }
    );
    let dispatchCalls = 0;
    const dispatch = action => {
      dispatchCalls++;
      if (dispatchCalls === 1) {
        expect(action.test).to.equal(123);
      }
    };
    await action(dispatch, getEmptyState);
    expect(dispatchCalls).to.equal(2);
  });

  it('should allow function action mutation', async function() {
    global.fetch = fetchSuccess;
    const action = fetchActionCreator(
      ID, URL, INIT, {
        onRequest: requestAction => ({
          type: 'NEW'
        })
      }
    );
    let dispatchCalls = 0;
    const dispatch = action => {
      dispatchCalls++;
      if (dispatchCalls === 1) {
        expect(action.type).to.equal('NEW');
      }
    };
    await action(dispatch, getEmptyState);
    expect(dispatchCalls).to.equal(2);
  });

  // RESOLVE return
  it('should return a request action', async function() {
    global.fetch = fetchSuccess;
    const action = fetchActionCreator(ID, URL, INIT);
    const dispatch = ({ type }) => {};
    const result = await action(dispatch, getEmptyState);
    expect(result).to.have.own.property('type');
    expect(result.type).to.equal(`RESOLVE_${ID}`);
    expect(result).to.have.own.property('body');
    expect(result).to.have.own.property('statusCode');
    expect(result.statusCode).to.equal(200);
  });

  // REJECT return
  it('should return a fetch 404 action', async function() {
    global.fetch = fetchError404;
    const action = fetchActionCreator(ID, URL, INIT);
    const dispatch = ({ type }) => {};
    const result = await action(dispatch, getEmptyState);
    expect(result).to.have.own.property('type');
    expect(result.type).to.equal(`REJECT_${ID}`);
    expect(result).to.have.own.property('error');
    expect(result).to.have.own.property('statusCode');
    expect(result.statusCode).to.equal(404);
  });


});
