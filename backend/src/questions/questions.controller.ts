import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';

interface RequestWithUser {
  user?: {
    userId: string;
  };
}

@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  create(
    @Body() createQuestionDto: CreateQuestionDto,
    @Request() req: RequestWithUser,
  ) {
    return this.questionsService.create(createQuestionDto, req.user?.userId);
  }

  @Get('product/:productId')
  findByProduct(@Param('productId') productId: string) {
    return this.questionsService.findByProduct(productId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('user')
  findByUser(@Request() req: any) {
    return this.questionsService.findByUser(req.user.userId as string);
  }
}
