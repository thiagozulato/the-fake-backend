import { createServer } from './server';
import { Server, RouteProperties, Route } from './interfaces';
import { MethodType } from './enums';

jest.mock('../source/ui', () => ({
  UIManager: () => ({
    drawDashboard: jest.fn(),
    drawRequest: jest.fn(),
    writeRouteProxyChanged: jest.fn(),
    writeMethodOverrideChanged: jest.fn(),
    createDrawRequestMiddleware: jest.fn(),
  }),
}));

jest.mock('../source/routes', () => {
  let routes: Route[] = [];

  return {
    resolveMethodAttribute: jest.fn(),
    RouteManager: () => ({
      getAll: jest.fn(() => routes),
      setAll: jest.fn((newRoutes) => {
        routes = newRoutes;
      }),
      addDocsRoute: jest.fn(),
      createResolvedRouteMiddleware: jest.fn(),
      createRouteMethodResponseMiddleware: jest.fn(),
    }),
  };
});

jest.mock('../source/input', () => ({
  InputManager: () => ({
    addListener: jest.fn(),
    init: jest.fn(),
  }),
}));

const expressServer = {
  get: jest.fn(),
  use: jest.fn(),
  listen: jest.fn(),
};

jest.mock('express', () => {
  const fn = () => expressServer;
  fn.json = jest.fn();
  fn.Router = jest.fn(() => ({ get: jest.fn() }));
  return fn;
});

describe('source/server.ts', () => {
  let server: Server;

  beforeEach(() => {
    server = createServer();
  });

  describe('createServer', () => {
    it('returns an instance of Server', () => {
      expect(server).toMatchObject<Server>(server);
    });
  });

  describe('routes', () => {
    it('defines the server routes', () => {
      const routes: RouteProperties[] = [
        {
          path: '/users',
          methods: [{ type: MethodType.GET, data: 'Users' }],
        },
        { path: '/dogs', methods: [{ type: MethodType.GET, data: 'Dogs' }] },
        {
          path: '/cats',
          methods: [
            {
              type: MethodType.GET,
              data: [{ name: 'Cat' }],
            },
          ],
        },
      ];
      server.routes(routes);
      expect(expressServer.get).toHaveBeenCalled();
    });
  });

  describe('listen', () => {
    it('starts listening on given ports', () => {
      server.listen(8081);
      expect(expressServer.listen).toHaveBeenCalledWith(8081);
    });
  });
});
