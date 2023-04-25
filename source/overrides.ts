import {
  complement,
  either,
  equals,
  isEmpty,
  isNil,
  pipe,
  prop,
  propOr,
  propSatisfies,
} from 'ramda';
import { Method, MethodOverride, Route, Override } from './interfaces';
import {
  promptRoutePath,
  promptRouteMethodType,
  promptRouteMethodOverride,
} from './prompts';
import {
  findRouteByUrl,
  getRoutesPaths,
  findRouteMethodByType,
  formatMethodType,
  RouteManager,
} from './routes';
import { FileStorage } from './storage';
import { Middleware } from './types';

const OVERRIDE_DEFAULT_OPTION = 'Default';

const isNotEmpty = complement(either(isNil, isEmpty));

function getOverridesNames(overrides: MethodOverride[]) {
  return overrides.map(prop('name'));
}

function getOverridesNamesWithDefault(overrides: MethodOverride[]) {
  return [OVERRIDE_DEFAULT_OPTION, ...getOverridesNames(overrides)];
}

function getMethodOverridesByType({ methods }: Route, routeMethodType: string) {
  const method = findRouteMethodByType(methods, routeMethodType);

  const { overrides } = method;

  if (overrides) {
    return overrides;
  }

  throw new Error(`Method with type "${routeMethodType}" has no "overrides"`);
}

function filterOverridableMethods(methods: Method[]) {
  return methods.filter(propSatisfies(isNotEmpty, 'overrides'));
}

function getOverridableRoutesMethodsTypesNames(route: Route) {
  return filterOverridableMethods(route.methods).map(
    pipe(prop('type'), formatMethodType)
  );
}

function findSelectedMethodOverride(method: Method) {
  return method.overrides?.find(propSatisfies(equals(true), 'selected'));
}

const FILE_STORAGE_KEY = 'overrides';

export class OverrideManager {
  /**
   * Creates a new override manager.
   *
   * @param routeManager An instance of route manager
   */
  constructor(
    private routeManager: RouteManager,
    private fileStorage?: FileStorage<typeof FILE_STORAGE_KEY>
  ) {}

  applyExternalOverrides() {
    if (!this.fileStorage?.options.enabled || !this.fileStorage.isInitialized())
      return;

    if (this.fileStorage.isEmpty()) {
      this.fileStorage?.setItem(FILE_STORAGE_KEY, this.getAllSelected());
    } else {
      const persistedOverrides = this.fileStorage.getItem<Override[]>(
        FILE_STORAGE_KEY
      );

      persistedOverrides?.forEach((override) => {
        const overridableRoutes = this.getAll();
        const url = override.routePath;
        const route = findRouteByUrl(overridableRoutes, url);
        const type = override.methodType;
        const overrides = getMethodOverridesByType(route, type.toLowerCase());
        const name = override.name;
        overrides.forEach((override) => {
          override.selected = override.name === name;
        });
      });
    }
  }

  /**
   * Get routes with overrides.
   *
   * @return An array containing all the routes with overrides
   */
  getAll() {
    return this.routeManager
      .getAll()
      .filter(
        pipe(propOr([], 'methods'), filterOverridableMethods, isNotEmpty)
      );
  }

  /**
   * Get the selected route method overrides.
   *
   * @return An array containing all the selected overrides.
   */
  getAllSelected(): Override[] {
    return this.routeManager.getAll().reduce<Override[]>((acc, route) => {
      route.methods.forEach((method) => {
        const selectedOverride = findSelectedMethodOverride(method);

        if (selectedOverride) {
          acc.push({
            routePath: route.path,
            methodType: method.type,
            name: selectedOverride.name,
          });
        }
      });

      return acc;
    }, []);
  }

  /**
   * Select a route method override when using REST API
   * @param path The route path
   * @param type The route method type (GET, PUT, POST, DELETE)
   * @param name The override name for custom response
   * @returns The selected route
   */
  chooseRestClient(path: string, type: string, name: string): Override {
    const overridableRoutes = this.getAll();
    const route = findRouteByUrl(overridableRoutes, path);
    const overrides = getMethodOverridesByType(route, type.toLowerCase());

    overrides.forEach((override) => {
      override.selected = override.name === name;
    });

    this.fileStorage?.setItem('overrides', this.getAllSelected());

    return { routePath: path, methodType: type, name };
  }

  /**
   * Prompt and select a route method override.
   */
  async choose(): Promise<Override> {
    const overridableRoutes = this.getAll();
    const { url } = await promptRoutePath(getRoutesPaths(overridableRoutes));
    const route = findRouteByUrl(overridableRoutes, url);
    const methodTypes = getOverridableRoutesMethodsTypesNames(route);
    const { type } = await promptRouteMethodType(methodTypes);
    const overrides = getMethodOverridesByType(route, type.toLowerCase());
    const { name } = await promptRouteMethodOverride(
      getOverridesNamesWithDefault(overrides)
    );

    overrides.forEach((override) => {
      override.selected = override.name === name;
    });

    this.fileStorage?.setItem('overrides', this.getAllSelected());

    return { routePath: url, methodType: type, name };
  }

  /**
   * Create a middleware that merges a route with the selected override.
   */
  createOverriddenRouteMethodMiddleware(): Middleware {
    return (_req, res, next) => {
      const { routeMethod } = res.locals;
      const selectedOverride = findSelectedMethodOverride(routeMethod);

      if (selectedOverride) {
        res.locals.routeMethod = {
          ...routeMethod,
          ...selectedOverride,
        };
      }

      next();
    };
  }

  /**
   * Create a middleware that applies a given route override content function.
   */
  createOverriddenRouteContentMiddleware(): Middleware {
    return (req, res, next) => {
      const { response, routeMethod } = res.locals;
      const { overrideContent } = routeMethod;

      if (overrideContent) {
        res.locals.response = overrideContent(req, response);
      }

      next();
    };
  }
}
