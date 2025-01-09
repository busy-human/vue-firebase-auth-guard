import {Router} from "vue-router";
import {Auth} from "firebase/auth";
import { AuthGuardOptions } from "./types.js";
import { AuthGuardTracker } from "./tracker.js";
import { MainAuth, initializeAuthState } from "./auth-state.js";

class AuthGuardClass {
    install(router: Router, auth: Auth, options: AuthGuardOptions) {
        const guard = new AuthGuardTracker({
            ...options,
            router
        });

        initializeAuthState(auth, options.modelResolver);

        MainAuth.onChange((data) => {
            if (!data.hasCheckedForSession) {
                guard.resumeRouting();

            } else if (data.loggedIn && guard.isPublicRoute(router.currentRoute.value.path)) {
                // The data.loggedIn just logged in / signed up
                guard.pushToPostAuthPath();

            } else if (!data.loggedIn) {
                // The user just logged out / signed out
                router.push(guard.config.publicLanding);
            }
        });

        router.beforeEach((to, from, next) => {
            if (!MainAuth.hasCheckedForSession) {
                console.log(to);
                // We haven't checked for a session yet, so wait before routing
                guard.deferredRouting = { to, from, next };
            } else {
                guard.resolvePath(to, from, next);
            }
        });
    }
};

const AuthGuard = new AuthGuardClass();

export { AuthGuard };
export default AuthGuard;