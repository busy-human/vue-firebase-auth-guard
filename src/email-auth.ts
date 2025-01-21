import { User, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, ParsedToken } from "firebase/auth";
import { FirebaseError } from "@firebase/util";
import { MainAuth, assertMainAuth } from "./auth-state.js";

class EmailPasswordAuthenticatorClass {

    async signInWithEmailAndPassword(email: string, password: string) {
        assertMainAuth();
        try {
            const result = await signInWithEmailAndPassword(MainAuth.auth, email, password);
            return { success: true, user: result.user };
        } catch (e) {
            console.error('Unable to sign in with email and password:', e);
            return { success: false, reason: MainAuth.convertAuthError((e as FirebaseError).code) };
        }
    }

    async createUserWithEmailAndPassword(email: string, password: string) {
        assertMainAuth();
        try {
            const result = await createUserWithEmailAndPassword(MainAuth.auth, email, password);
            return { success: true, user: result.user };
        } catch (e) {
            console.error('Unable to create user with email and password:', e);
            return { success: false, reason: MainAuth.convertAuthError((e as FirebaseError).code) };
        }
    }

    sendPasswordReset(email: string) {
        return sendPasswordResetEmail(MainAuth.auth, email);
    }
}

let instance: EmailPasswordAuthenticatorClass;

export function getEmailPasswordAuthenticator() {
    if(!instance) {
        instance = new EmailPasswordAuthenticatorClass();
    }
    return instance;
}