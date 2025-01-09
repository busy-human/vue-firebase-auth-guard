import { onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as logOut, sendPasswordResetEmail, ParsedToken, getIdTokenResult, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import { computed, ref } from "vue";
import { FirebaseError } from "@firebase/util";
import { MainAuth, assertMainAuth } from "./auth-state";

class PhoneNumberAuthenticatorClass {
    recaptchaVerifier : RecaptchaVerifier | null;
    recaptchaTargetElement: HTMLElement | string | null;
    confirmationResult: ConfirmationResult | null;
    recaptchaWidgetId: number | null;

    constructor(recaptchaTargetElement: HTMLElement | string) {
        this.recaptchaTargetElement = recaptchaTargetElement;
        this.recaptchaWidgetId = null;
        this.recaptchaVerifier = null;
        this.confirmationResult = null;
    }
    async submitPhoneNumber(phoneNumber: string){
        assertMainAuth();

        if(!this.recaptchaVerifier){
            if(this.recaptchaTargetElement){
                try{
                    this.recaptchaVerifier = new RecaptchaVerifier(MainAuth.auth, this.recaptchaTargetElement);
                    this.recaptchaWidgetId = await this.recaptchaVerifier.render();
                }catch(e){
                    throw new Error('Unable to initialize Recaptcha, make sure ContainerId is the Id of the container you will use, and that its already rendered in the DOM');
                }
            }else{
                throw new Error('Recaptcha Verifier has not been setup, make sure to initialize before calling submit, or pass in the containerId');
            }
        }

        try{
            this.confirmationResult = await signInWithPhoneNumber(MainAuth.auth, phoneNumber, this.recaptchaVerifier);
            return { success: true };
        }catch(e){
            console.error('Unable to send SMS Verification:', e);
            return { success: false, reason: MainAuth.convertAuthError((e as FirebaseError).code) };
        }
    }

    async verifyCode(verificationCode: string){
        assertMainAuth();
        if(!this.confirmationResult) throw new Error('Confirmation result isnt ready, make sure the phone number has been successfully submitted first');

        try{
            const result = await this.confirmationResult.confirm(verificationCode);

            return { success: true };
        }catch(e){
            console.error('Unable to verify User Code', e);
            return { success: false, reason: MainAuth.convertAuthError((e as FirebaseError).code) };
        }
    }

    resetCaptcha() {
        assertMainAuth();
        this.recaptchaVerifier = null;
        this.recaptchaWidgetId = null;
        this.confirmationResult = null;
    }

}

let instance: PhoneNumberAuthenticatorClass;

export function getPhoneNumberAuthenticator(recaptchaTargetElement: HTMLElement | string) {
    if(!instance) {
        instance = new PhoneNumberAuthenticatorClass(recaptchaTargetElement);
    }
    return instance;
}