import express, { Application, Router } from 'express';
import bodyParser from 'body-parser';
import { RouteManager } from '../routes';
import { OverrideManager } from '../overrides';
import { Request, Response } from '../interfaces';
import { ResponseError } from './error/response-error';
import {
  FilterMockResponseQuery,
  FilterRouteQuery,
  UseRouteOverride,
} from './types';
import { getPathMockContent } from './utils';

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
        const { path } = request.query as FilterRouteQuery;
        const routes = path ? this.getRouteByPath(path) : this.getAllPaths();

        return response.send(routes);
      } catch (error) {
        const { message } = error as Error;
        return response.status(400).send(new ResponseError(message));
      }
    };
  }

  private getPathMockResponse() {
    return (request: Request, response: Response) => {
      try {
        const {
          path,
          type,
          overrideName,
        } = request.query as FilterMockResponseQuery;

        const content = getPathMockContent(
          this.routeManager.findRouteByPath(path),
          type,
          overrideName
        );

        return response.send(content);
      } catch (error) {
        const { message } = error as Error;
        return response.status(400).send(new ResponseError(message));
      }
    };
  }

  private usePathOverride() {
    return (request: Request, response: Response) => {
      try {
        const { path, type, name } = request.body as UseRouteOverride;

        const overrideResponse = this.overrideManager.chooseRestClient(
          path,
          type,
          name
        );

        return response.send(overrideResponse);
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
    this.router.get('/routes', this.getAllRoutes());
    this.router.post('/routes/use-override', this.usePathOverride());
    this.router.get('/routes/content', this.getPathMockResponse());
  }

  build(app: Application) {
    this.router.use(bodyParser.json());
    this.settingRoutes();
    app.use('/admin', this.router);
  }
}
