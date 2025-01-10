import {Router} from "vue-router";
import {Auth} from "firebase/auth";
import { AuthGuardOptions } from "./types.js";
import { AuthGuardTracker } from "./guard.js";
import { MainAuth, assertMainAuth } from "./auth-state.js";

class AuthGuardBootstrapper {
    install(router: Router, options: AuthGuardOptions) {
        assertMainAuth();

        const guard = new AuthGuardTracker({
            ...options,
            router
        });

        MainAuth.onChange((data) => {
            if (!data.hasCheckedForSession) {
                guard.resumeRouting();

            } else if (data.loggedIn && guard.isPublicRoute(router.currentRoute.value.path)) {
                // The data.loggedIn just logged in / signed up
                guard.pushTo("postAuth");

            } else if (!data.loggedIn) {
                // The user just logged out / signed out
                guard.pushTo("publicLanding");
            }
        });

        router.beforeEach((to, from, next) => {
            if (!MainAuth.hasCheckedForSession) {
                console.log(to);
                // We haven't checked for a session yet, so wait before routing
                guard.deferredRouting = { to, from, next };
            } else {
                guard.resolveRoute(to, from, next);
            }
        });

        return guard;
    }
};

const AuthGuard = new AuthGuardBootstrapper();

export { AuthGuard };
export default AuthGuard;