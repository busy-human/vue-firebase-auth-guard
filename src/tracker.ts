import { Auth, User as FirebaseUser } from "firebase/auth";
import { Router, RouteLocationNormalizedGeneric, RouteLocationNormalizedLoadedGeneric, NavigationGuardNext, RouteLocationResolvedGeneric } from "vue-router";
import { CallbackController, Callback } from "./callbacks.js";
import { AuthGuardOptions, DeferredRouting, AuthGuardTrackerOptions, AUTH_DEFAULTS, AuthRouteMeta} from "./types.js";
import { MainAuth } from "./auth-state.js";

function resolveOptions(defaults: AuthGuardOptions, overrides: AuthGuardOptions) {
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
    deferredRouting?            : DeferredRouting;
    onCheckedForSessionCallbacks: CallbackController<ResumeRoutingCallbackOptions>;

    constructor(options: AuthGuardTrackerOptions) {
        this.router = options.router;
        this.onCheckedForSessionCallbacks = new CallbackController();
        this.config = resolveOptions(AUTH_DEFAULTS, options);


        if (!this.config.postAuthPath) {
            console.warn('You must pass in postAuthPath with the AuthGuard.install options');
        }
    }
    onCheckedForSession(callback: Callback<ResumeRoutingCallbackOptions>) {
        this.onCheckedForSessionCallbacks.add(callback, { once: true });
    }
    resolvePostAuthPath() {
        if (typeof this.config.postAuthPath === "function") {
            return Promise.resolve(this.config.postAuthPath(this.router, MainAuth.firebaseUser));
        } else {
            return Promise.resolve(this.config.postAuthPath);
        }
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
    async pushToPostAuthPath() {
        const path = await this.resolvePostAuthPath();
        if(!path) {
            console.log(this.config);
            throw new Error("Failed to resolve postAuthPath");
        }
        this.router.push(path);
    }
    async resumeRouting() {
        if (this.deferredRouting && (this.isPublicRoute(this.deferredRouting.to) || MainAuth.loggedIn)) {
            console.log("Resuming attempted routing");
            var rt = this.deferredRouting;
            delete this.deferredRouting;
            if (MainAuth.loggedIn && this.isLoginPage(rt.to)) {
                await this.pushToPostAuthPath();
            } else {
                this.resolvePath(rt.to, rt.from, rt.next);
            }
        } else if (MainAuth.loggedIn) {
            console.log("Router: User logged in");
            await this.pushToPostAuthPath();
            this.onCheckedForSessionCallbacks.run({ router: this.router });
        } else {
            console.log("Router: No session");
            this.router.push(this.config.loginPath);
            this.onCheckedForSessionCallbacks.run({ router: this.router });
        }
    }

    isLoginPage(path: string | RouteLocationNormalizedGeneric) {
        var pathStr = (typeof path === "string" ? path : path.fullPath);
        return pathStr.indexOf(this.config.loginPath) >= 0;
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
    resolvePath( to: RouteLocationNormalizedGeneric, from: RouteLocationNormalizedLoadedGeneric, next: NavigationGuardNext) {
        var toPath = to.path || to;

        var requiresAuth = this.isAuthenticatedRoute(toPath);
        var authorizedToView = !requiresAuth || MainAuth.loggedIn;

        if (authorizedToView) {
            next();
        } else {
            next(this.config.loginPath);
        }
    };
}