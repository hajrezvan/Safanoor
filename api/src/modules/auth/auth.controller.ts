import {
  HttpCode,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import {
  CurrentActor,
  ActorRequest,
  Policy,
  Public,
} from '../access/policy.decorator';
import { Actor } from '../access/access.types';
import { LoginDto, PasswordDto, RefreshDto } from './auth.dto';
import { AuthService, TokenPair } from './auth.service';
import { cookieValue } from './auth.guard';

export class AuthResponseDto {
  @ApiProperty() authenticated!: boolean;
  @ApiProperty() csrfToken!: string;
  @ApiProperty() expiresIn!: number;
  @ApiProperty({ required: false }) accessToken?: string;
  @ApiProperty({ required: false }) refreshToken?: string;
}
export class CsrfResponseDto {
  @ApiProperty() csrfToken!: string;
}
export class SuccessDto {
  @ApiProperty() success!: boolean;
}
export const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict' as const,
};
@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public()
  @Get('csrf')
  @ApiOkResponse({ type: CsrfResponseDto })
  csrf(@Res({ passthrough: true }) response: Response): CsrfResponseDto {
    const csrfToken = randomBytes(32).toString('base64url');
    response.cookie('sf_csrf', csrfToken, {
      ...cookieOptions,
      path: '/api',
      maxAge: 30 * 86400000,
    });
    response.setHeader('Cache-Control', 'no-store');
    return { csrfToken };
  }
  @Public()
  @HttpCode(200)
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOkResponse({ type: AuthResponseDto })
  async login(
    @Body() input: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    return this.deliver(
      await this.auth.login(input.login, input.password),
      request,
      response,
    );
  }
  @Public()
  @HttpCode(200)
  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOkResponse({ type: AuthResponseDto })
  async refresh(
    @Body() input: RefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const token =
      request.headers['x-client-type'] === 'native'
        ? input.refreshToken
        : cookieValue(request, 'sf_refresh');
    return this.deliver(
      await this.auth.refresh(token ?? ''),
      request,
      response,
    );
  }
  @Policy('person', 'read')
  @HttpCode(200)
  @Post('logout')
  @ApiOkResponse({ type: SuccessDto })
  async logout(
    @CurrentActor() actor: Actor,
    @Req() request: ActorRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SuccessDto> {
    await this.auth.logout(actor, request.sessionId);
    for (const [name, path] of [
      ['sf_access', '/api'],
      ['sf_refresh', '/api/v1/auth'],
      ['sf_csrf', '/api'],
    ])
      response.clearCookie(name, { ...cookieOptions, path });
    return { success: true };
  }
  @Policy('person', 'read')
  @HttpCode(200)
  @Post('password')
  @ApiOkResponse({ type: SuccessDto })
  async password(
    @CurrentActor() actor: Actor,
    @Body() input: PasswordDto,
  ): Promise<SuccessDto> {
    await this.auth.changePassword(
      actor,
      input.currentPassword,
      input.newPassword,
    );
    return { success: true };
  }
  private deliver(
    pair: TokenPair,
    request: Request,
    response: Response,
  ): AuthResponseDto {
    response.setHeader('Cache-Control', 'no-store');
    if (request.headers['x-client-type'] === 'native')
      return { authenticated: true, ...pair };
    response.cookie('sf_access', pair.accessToken, {
      ...cookieOptions,
      path: '/api',
      maxAge: pair.expiresIn * 1000,
    });
    response.cookie('sf_refresh', pair.refreshToken, {
      ...cookieOptions,
      path: '/api/v1/auth',
      maxAge: 30 * 86400000,
    });
    response.cookie('sf_csrf', pair.csrfToken, {
      ...cookieOptions,
      path: '/api',
      maxAge: 30 * 86400000,
    });
    return {
      authenticated: true,
      csrfToken: pair.csrfToken,
      expiresIn: pair.expiresIn,
    };
  }
}
