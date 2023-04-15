import express, { Application, Router } from 'express';
import { RouteManager, findRouteMethodByType } from '../routes';
import { OverrideManager } from '../overrides';
import { Method, Request, Response, Route } from '../interfaces';
import { prop } from 'ramda';
import { ResponseError } from './response-error';
import { readFixtureSync } from '../files';

export function resolveAttributeContentRest(route: Route) {
  const routeMethod = {};
  const data = '';
  const file = '';
  const content = data || readFixtureSync(file, route.path, '');

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
