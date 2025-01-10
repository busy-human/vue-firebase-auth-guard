import { Auth, User as FirebaseUser } from "firebase/auth";
import { Router, RouteLocationNormalizedGeneric, RouteLocationNormalizedLoadedGeneric, NavigationGuardNext, RouteLocationResolvedGeneric } from "vue-router";
import { CallbackController, Callback } from "./callbacks.js";
import { AuthGuardOptions, DeferredRouting, AuthGuardTrackerOptions, AUTH_DEFAULTS, AuthRouteMeta, AuthRouteMap} from "./types.js";
import { MainAuth } from "./auth-state.js";

function resolveOptions(defaults: AuthGuardOptions, overrides: Partial<AuthGuardOptions>) {
    return Object.assign({}, defaults, overrides);
}

function resolveMeta(routeOrRouteLike: RouteLocationNormalizedGeneric | RouteLocationResolvedGeneric): AuthRouteMeta {
    return routeOrRouteLike.meta;
}

type ResumeRoutingCallbackOptions = {
    router: Router;
}

export class AuthGuardTracker {
    router                      : Router;
    config                      : AuthGuardOptions = AUTH_DEFAULTS;
    userRouting?                : Partial<AuthRouteMap>
    deferredRouting?            : DeferredRouting;
    onCheckedForSessionCallbacks: CallbackController<ResumeRoutingCallbackOptions>;

    constructor(options: AuthGuardTrackerOptions) {
        this.router = options.router;
        this.onCheckedForSessionCallbacks = new CallbackController();
        this.config = resolveOptions(AUTH_DEFAULTS, options);

        // Track changes to the user routing
        MainAuth.onChange((data) => {
            this.userRouting = data.routes;
        });

        if (!this.config.routes.postAuth) {
            console.warn('You must pass in postAuth with the AuthGuard.install options');
        }
    }
    onCheckedForSession(callback: Callback<ResumeRoutingCallbackOptions>) {
        this.onCheckedForSessionCallbacks.add(callback, { once: true });
    }
    pathFor(routeType: keyof AuthRouteMap) {
        return this.userRouting?.[routeType] || this.config.routes[routeType];
    }
    /**
     * Public Routes do not require authentication
     */
    isPublicRoute(pathOrRoute: string | RouteLocationNormalizedGeneric) {
        const path = typeof pathOrRoute === "string"? pathOrRoute : pathOrRoute.path;
        let isPublic: boolean = this.config.assumeIfUndefined === "public" ? true : false;
        var resolvedRoute = this.router.resolve(path);
        if (this.isLoginPage(path)) {
            isPublic = true;
        } else if (resolvedRoute) {
            let requiresAuth = resolveMeta(resolvedRoute).requiresAuth;
            isPublic = requiresAuth === undefined ? isPublic : !requiresAuth;
        }

        return isPublic;
    }
    async pushTo(routeType: keyof AuthRouteMap) {
        const path = this.pathFor(routeType);
        if(!path) {
            console.log(this.config);
            throw new Error(`Failed to resolve ${routeType}`);
        }
        this.router.push(path);
    }
    async resumeRouting() {
        if (this.deferredRouting && (this.isPublicRoute(this.deferredRouting.to) || MainAuth.loggedIn)) {
            console.log("Resuming attempted routing");
            var rt = this.deferredRouting;
            delete this.deferredRouting;
            if (MainAuth.loggedIn && this.isLoginPage(rt.to)) {
                await this.pushTo("postAuth");
            } else {
                this.resolveRoute(rt.to, rt.from, rt.next);
            }
        } else if (MainAuth.loggedIn) {
            console.log("Router: User logged in");
            await this.pushTo("postAuth");
            this.onCheckedForSessionCallbacks.run({ router: this.router });
        } else {
            console.log("Router: No session");
            this.router.push(this.config.routes.login);
            this.onCheckedForSessionCallbacks.run({ router: this.router });
        }
    }

    isLoginPage(path: string | RouteLocationNormalizedGeneric) {
        var pathStr = (typeof path === "string" ? path : path.fullPath);
        return pathStr.indexOf(this.config.routes.login) >= 0;
    };

    /**
     * Users must be logged in to view authenticated routes
     */
    isAuthenticatedRoute(path: string | RouteLocationNormalizedGeneric) {
        let requiresAuth = this.config.assumeIfUndefined === "auth" ? true : false;

        const resolvedRoute = this.router.resolve(path);
        if (this.isLoginPage(path)) {
            requiresAuth = false;
        } else if (resolvedRoute && resolveMeta(resolvedRoute) && resolveMeta(resolvedRoute).requiresAuth !== undefined) {
            requiresAuth = !!resolveMeta(resolvedRoute).requiresAuth;
        }

        return requiresAuth;
    };

    /**
     * Checks whether the user is permitted to navigate to the route
     */
    resolveRoute( to: RouteLocationNormalizedGeneric, from: RouteLocationNormalizedLoadedGeneric, next: NavigationGuardNext) {
        var toPath = to.path || to;

        var requiresAuth = this.isAuthenticatedRoute(toPath);
        var authorizedToView = !requiresAuth || MainAuth.loggedIn;

        if (authorizedToView) {
            next();
        } else {
            next(this.config.routes.login);
        }
    };
}