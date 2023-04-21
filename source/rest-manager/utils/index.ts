import { propEq } from 'ramda';
import { readFixtureSync } from '../../files';
import { Method, Route } from '../../interfaces';
import { findRouteMethodByType } from '../../routes';

const RUNTIME_RESPONSE_MOCK_MESSAGE = {
  message: 'The data will be resolved at runtime',
};

export function isFunction(attribute: unknown) {
  return typeof attribute === 'function';
}

export function findSelectedMethodOverride(
  method: Method,
  overrideName: string
) {
  return method.overrides?.find(propEq('name', overrideName));
}

export function getMethodAttributes(method: Method, overrideName: string) {
  if (overrideName && overrideName.toLowerCase() !== 'default') {
    const overrideMethod = findSelectedMethodOverride(method, overrideName);

    return {
      data: overrideMethod?.data,
      file: overrideMethod?.file as string,
      scenario: overrideMethod?.scenario,
    };
  }

  return {
    data: method.data,
    file: method.file as string,
    scenario: method.scenario,
  };
}

export function getPathMockContent(
  route: Route,
  type: string,
  overrideName: string
) {
  const { path, methods } = route;
  const routeMethod = findRouteMethodByType(methods, type);
  const { data, file, scenario } = getMethodAttributes(
    routeMethod,
    overrideName
  );

  if (isFunction(data) || isFunction(file)) {
    return RUNTIME_RESPONSE_MOCK_MESSAGE;
  }

  return data || readFixtureSync(file || path, path, scenario);
}
