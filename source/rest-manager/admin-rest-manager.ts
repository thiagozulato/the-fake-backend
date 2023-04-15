import express, { Application, Router } from 'express';
import { RouteManager, findRouteMethodByType } from '../routes';
import { OverrideManager } from '../overrides';
import { Method, Request, Response, Route } from '../interfaces';
import { over, prop, propEq } from 'ramda';
import { ResponseError } from './response-error';
import { readFixtureSync } from '../files';

function findSelectedMethodOverride(method: Method, overrideName: string) {
  return method.overrides?.find(propEq('name', overrideName));
}

function getDataAndFile(method: Method, overrideName: string) {
  if (overrideName) {
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

function resolveAttributeContentRest(
  route: Route,
  type: string,
  overrideName: string
) {
  const { path, methods } = route;
  console.log('RESOLVE ', path);
  const routeMethod = findRouteMethodByType(methods, type);
  const { data, file, scenario } = getDataAndFile(routeMethod, overrideName);
  console.log('CONTENT ', data, file, scenario, JSON.stringify(routeMethod));

  const content = data || readFixtureSync(file || path, path, scenario);

  return content;
}

export class AdminRestManager {
  private router: Router;

  constructor(
    private routeManager: RouteManager,
    private overrideManager: OverrideManager
  ) {
    this.router = express.Router();
  }

  private getAllRoutes() {
    return (request: Request, response: Response) => {
      try {
        const { path } = request.query;
        const routes = path
          ? this.getRouteByPath(path as string)
          : this.getAllPaths();

        if (routes.length) {
          return response.send(routes);
        }
      } catch (error) {
        const { message } = error as Error;
        return response.status(400).send(new ResponseError(message));
      }
    };
  }

  private getPathMockResponse() {
    return (request: Request, response: Response) => {
      try {
        const { path, type, overrideName } = request.query;
        console.log(path, type, overrideName);
        const content = resolveAttributeContentRest(
          this.routeManager.findRouteByPath(path as string),
          type as string,
          overrideName as string
        );

        return response.send(content);
      } catch (error) {
        const { message } = error as Error;
        return response.status(400).send(new ResponseError(message));
      }
    };
  }

  private getAllPaths() {
    return this.routeManager.getAll().filter((route) => Boolean(route.path));
  }

  private getRouteByPath(path: string) {
    return [this.routeManager.findRouteByPath(path)];
  }

  private settingRoutes() {
    this.router.get('/paths', this.getAllRoutes());
    this.router.get('/path-content', this.getPathMockResponse());
  }

  build(app: Application) {
    this.settingRoutes();
    app.use('/admin', this.router);
  }
}
