import {AnyAction} from 'redux';
import {ThunkAction, ThunkDispatch} from 'redux-thunk';

export interface AbortAction {
  type: string;
}

export type ActionMutator<A extends FetchStateAction> = (
  action: A,
) => AnyAction;

export interface Actions {
  onAbort?: ActionMutator<AbortAction> | Object;
  onReject?: ActionMutator<RejectAction> | Object;
  onRequest?: ActionMutator<RequestAction> | Object;
  onResolve?: ActionMutator<ResolveAction> | Object;
}

interface Conditional {
  (state?: Object): boolean;
}

type FetchAction = ThunkAction<Promise<AnyAction>, any, void, AnyAction>;

export interface FetchActionTypes {
  ABORT: string;
  REJECT: string;
  REQUEST: string;
  RESOLVE: string;
}

export interface MakeFetchActions {
  default?: MakeFetchActions;
  (
    id: string,
    input: Request | string,
    init: Init,
    actions: Actions,
    abortController?: AbortController | null,
    conditional?: Conditional,
  ): FetchAction;
}

type FetchStateAction =
  | AbortAction
  | RejectAction
  | RequestAction
  | ResolveAction;

type Init = RequestInit | ((state?: Object) => RequestInit);

export interface RejectAction {
  error: Object | string;
  headers: Object | null;
  statusCode: null | number;
  type: string;
}

export interface RequestAction {
  type: string;
}

export interface ResolveAction {
  body: Object | string;
  headers: Object;
  statusCode: number;
  type: string;
}

class FetchError {
  headers: Object;
  message: Object | string;
  statusCode: number;

  constructor(message: Object | string, headers: Object, statusCode: number) {
    this.headers = headers;
    this.message = message;
    this.statusCode = statusCode;
  }
}

const MIN_ERROR_STATUS_CODE: number = 400;
const MAX_ERROR_STATUS_CODE: number = 600;

const createAction = (
  action: FetchStateAction,
  actionMutator?: ActionMutator<FetchStateAction> | null | Object,
): AnyAction => {
  if (!actionMutator) {
    return action;
  }
  if (typeof actionMutator === 'object') {
    return {
      ...action,
      ...actionMutator,
    };
  }
  return actionMutator(action);
};

const makeActionType = (subtype: string, id: string): string =>
  `${id}_${subtype}`;

const parseResponse = async function(
  response: Response,
): Promise<[Object | string, Object, number]> {
  const response2 = response.clone();
  let body = '';
  try {
    body = await response2.json();
  } catch (e) {
    body = await response.text();
  }

  // Convert headers into a plain object so redux doesn't complain
  let headers: any = {};
  response.headers.forEach(entry => {
    headers[entry[0]] = entry[1];
  });

  return [body, headers, response.status];
};

const fetchActionTypes = (id: string): FetchActionTypes => ({
  ABORT: makeActionType('ABORT', id),
  REQUEST: makeActionType('REQUEST', id),
  RESOLVE: makeActionType('RESOLVE', id),
  REJECT: makeActionType('REJECT', id),
});

const makeFetchActions: MakeFetchActions = (
  id: string,
  url: Request | string,
  init: Init | null = Object.create(null),
  actions: Actions | null = Object.create(null),
  abortController?: AbortController | null,
  conditional?: Conditional,
): FetchAction =>
  async function(
    dispatch: ThunkDispatch<any, void, AnyAction>,
    getState: () => Object,
  ): Promise<AnyAction> {
    // If we have a condition for fetching, check if we should continue.
    if (typeof conditional === 'function' && !conditional(getState())) {
      return {type: 'ERROR'};
    }

    // Implement AbortController, where possible.
    let signal: AbortSignal | null = null;

    // If this browser supports AbortController, create one.
    if (typeof AbortController !== 'undefined' && abortController) {
      signal = abortController.signal;

      // When the signal aborts, dispatch the abort action.
      signal.addEventListener('abort', () => {
        const abortAction: AbortAction = {
          type: makeActionType('ABORT', id),
        };
        dispatch(
          createAction(
            abortAction,
            actions !== null &&
              Object.prototype.hasOwnProperty.call(actions, 'onAbort')
              ? actions.onAbort
              : null,
          ),
        );
      });
    }

    // Dispatch the request action.
    const requestAction: RequestAction = {
      type: makeActionType('REQUEST', id),
    };
    dispatch(
      createAction(
        requestAction,
        actions !== null &&
          Object.prototype.hasOwnProperty.call(actions, 'onRequest')
          ? actions.onRequest
          : null,
      ),
    );

    const dispatchReject = (err: Error | FetchError): AnyAction => {
      const rejectAction: RejectAction = {
        error: err.message || 'Script error',
        headers: err instanceof FetchError ? err.headers : null,
        statusCode: err instanceof FetchError ? err.statusCode : null,
        type: makeActionType('REJECT', id),
      };

      const result = createAction(
        rejectAction,
        actions !== null &&
          Object.prototype.hasOwnProperty.call(actions, 'onReject')
          ? actions.onReject
          : null,
      );
      dispatch(result);
      return result;
    };

    // Fetch
    const requestInit: null | RequestInit =
      typeof init === 'function'
        ? init.length
          ? init(getState())
          : init()
        : init;

    let response: Response | null;
    try {
      response = await fetch(url, {signal, ...requestInit});
    } catch (caughtError) {
      return dispatchReject(caughtError);
    }

    const [body, headers, statusCode] = await parseResponse(response);
    // Check for an error status code.
    if (
      statusCode >= MIN_ERROR_STATUS_CODE &&
      statusCode < MAX_ERROR_STATUS_CODE
    ) {
      return dispatchReject(new FetchError(body, headers, statusCode));
    }

    // Dispatch the resolve action.
    const resolveAction: ResolveAction = {
      body,
      headers,
      statusCode,
      type: makeActionType('RESOLVE', id),
    };
    const result = createAction(
      resolveAction,
      actions !== null &&
        Object.prototype.hasOwnProperty.call(actions, 'onResolve')
        ? actions.onResolve
        : null,
    );
    dispatch(result);
    return result;
  };

module.exports = {
  makeFetchActions,
  fetchActionTypes,
};
exports.default = makeFetchActions;
