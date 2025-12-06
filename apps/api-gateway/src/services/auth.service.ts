import { BadRequestException, Inject, Injectable, InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { SignupDto } from "apps/auth/src/dto/signup.dto";
import { LoginGoogleDto } from "../core/dto/loginGoogle.dto";
import { loginDto } from "../core/dto/login.dto";
import { firstValueFrom } from "rxjs";

@Injectable()
export class AuthService {
    constructor(
        @Inject('AUTH_CLIENT') private authClient: ClientProxy
    ) { }

    async signUp(signUpData: SignupDto) {
        return this.authClient.send('auth.signUp', signUpData);
    }

    async login(loginData: loginDto) {
        const result = await firstValueFrom(
            this.authClient.send('auth.login', loginData)
        );

        // Kiểm tra kết quả và throw exception nếu cần
        if (!result.success) {
            if (result.statusCode === 401) {
                throw new UnauthorizedException(result.message);
            }
            if (result.statusCode === 400) {
                throw new BadRequestException(result.message);
            }
            throw new InternalServerErrorException(result.message);
        }

        // Trả về kết quả thành công
        return {
            accessToken: result.accessToken,
            message: result.message
        };
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