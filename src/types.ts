import {NavigationGuardNext, RouteLocationNormalizedGeneric, RouteLocationNormalizedLoadedGeneric, RouteMeta, Router} from "vue-router";
import {Auth, User as FirebaseUser, ParsedToken as CustomClaimsToken} from "firebase/auth";
import { UserModelResolver, UserModelMap } from "./user-model-resolver.js";

export interface AuthRouteMap<TypeMap extends UserModelMap, TypeName extends keyof TypeMap> {
    [key: string]: string | RouteResolver<TypeMap, TypeName> | undefined;

    /** This is the path to send users to, to login */
    publicLanding?: string;

    /** The redirect path after completing login */
    login: string;

    /** Where to redirect users that have logged out to */
    postAuth: string | RouteResolver<TypeMap, TypeName>;
}

export interface AuthGuardOptions {
    routes: Partial< AuthRouteMap<any, any> >,
    /** If a route isn't listed as 'auth' or 'public', assume this by default: */
    assumeIfUndefined: string;
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
    routes: {
        login: "/login",
        publicLanding: "/login",
        postAuth: "/"
    },
    assumeIfUndefined: "auth",
};


export interface AuthStateCallbackData<TypeMap extends UserModelMap, TypeName extends keyof TypeMap> {
    firebaseUser: FirebaseUser | null;
    userModel: TypeMap[TypeName] | null;
    userType: TypeName | null;
    claims: CustomClaimsToken | null;
    loggedIn: boolean;
    hasCheckedForSession: boolean;
}

export interface AuthLogOutOptions {
    cleanup?: boolean;
}

export type AuthEvent = "authenticated" | "unauthenticated" | "auth_checked" | "auth_error" | "model_updated" | "claims_updated";

export const AuthErrorMap: {[code: string]: string} = {
    'auth/invalid-email': "Invalid Email",
    'auth/user-not-found': "User Not Found",
    'auth/wrong-password': "Password Invalid",
    'auth/email-already-in-use': "Email Already In Use"
};

export type RouteResolver<TypeMap extends UserModelMap, TypeName extends keyof TypeMap> = (authData: AuthStateCallbackData<TypeMap, TypeName>, to: RouteLocationNormalizedGeneric, from: RouteLocationNormalizedLoadedGeneric, next: NavigationGuardNext) => void;