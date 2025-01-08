import {Router} from "vue-router";
import {Auth} from "firebase/auth";
import { AuthGuardOptions } from "./types.js";
import { AuthGuardTracker } from "./tracker.js";

class AuthGuardClass {
    install(router: Router, auth: Auth, options: AuthGuardOptions) {
        const guard = new AuthGuardTracker({
            ...options,
            router,
            auth
        });

        /**
         * Listen for changes to the user. The first event on this represents a successful session check
         */
        auth.onAuthStateChanged(async (user) => {
            guard.user = user;

            if (!guard.hasCheckedForSession) {
                guard.hasCheckedForSession = true;
                guard.resumeRouting();
            } else if (user && guard.isPublicRoute(router.currentRoute.value.path)) {
                // The user just logged in / signed up
                guard.pushToPostAuthPath();
            } else if (!user) {
                // The user just logged out / signed out
                router.push(guard.config.publicLanding);
            }
        });

        router.beforeEach((to, from, next) => {
            if (!guard.hasCheckedForSession) {
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