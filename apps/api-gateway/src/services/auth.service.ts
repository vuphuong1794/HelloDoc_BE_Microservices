import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { SignupDto } from "apps/auth/src/dto/signup.dto";
import { LoginGoogleDto } from "../core/dto/loginGoogle.dto";
import { loginDto } from "../core/dto/login.dto";

@Injectable()
export class AuthService {
    constructor(
        @Inject('AUTH_CLIENT') private authClient: ClientProxy
    ) { }

    async signUp(signUpData: SignupDto) {
        return this.authClient.send('auth.signUp', signUpData);
    }

    async login(loginData: loginDto) {
        return this.authClient.send('auth.login', loginData);
    }

    async loginGoogle(loginGoogleData: LoginGoogleDto) {
        return this.authClient.send('auth.login-google', loginGoogleData);
    }

    async requestOTP(email: string) {
        return this.authClient.send('auth.request-otp', email);
    }

    async requestOtpSignup(email: string) {
        return this.authClient.send('auth.request-otp-signup', email);
    }

    async verifyOTP(email: string, otp: string) {
        return this.authClient.send('auth.verify-otp', { email, otp });
    }

    async resetPassword(email: string, password: string) {
        return this.authClient.send('auth.reset-password', { email, password });
    }

    async generateGoogleTokens(email: string) {
        return this.authClient.send('auth.generate-token', email);
    }


}