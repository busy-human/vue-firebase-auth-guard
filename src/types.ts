import {NavigationGuardNext, RouteLocationNormalizedGeneric, RouteLocationNormalizedLoadedGeneric, RouteMeta, Router} from "vue-router";
import {Auth, User as FirebaseUser} from "firebase/auth";
import { UserModelResolver, UserModelMap } from "./user-model-resolver.js";

export interface AuthGuardOptions {
    /** This is the path to send users to, to login */
    loginPath: string;

    /** The redirect path after completing login */
    postAuthPath?: string | ((router: Router, user?: FirebaseUser | null) => string);

    /** Where to redirect users that have logged out to */
    publicLanding: string;

    /** If a route isn't listed as 'auth' or 'public', assume this by default: */
    assumeIfUndefined: string;

    /** The resolver for the user model (aka userspace) */
    modelResolver?: UserModelResolver<UserModelMap>;
}

export type AuthGuardTrackerOptions = Omit<AuthGuardOptions, "modelResolver"> & {
    router: Router;
}

export interface DeferredRouting {
    to: RouteLocationNormalizedGeneric;
    from: RouteLocationNormalizedLoadedGeneric;
    next: NavigationGuardNext;
}

export type AuthRouteMeta = RouteMeta & { requiresAuth?: boolean };

export const AUTH_DEFAULTS: AuthGuardOptions = {
    loginPath: "/login",
    publicLanding: "/login",
    assumeIfUndefined: "auth",
};