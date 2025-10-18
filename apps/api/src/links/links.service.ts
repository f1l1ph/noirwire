import { Injectable } from '@nestjs/common';

import { Link } from '@repo/api/links/entities/link.entity';

import { CreateLinkDto } from '@repo/api/links/dto/create-link.dto';
import { UpdateLinkDto } from '@repo/api/links/dto/update-link.dto';

@Injectable()
export class LinksService {
  // REMOVED DEMO DATA FOR HACKATHON
  // Originally had Turborepo documentation links for testing
  private readonly _links: Link[] = [];

  create(createLinkDto: CreateLinkDto) {
    return `This action adds a new link ${createLinkDto}`;
  }

  findAll() {
    return this._links;
  }

  findOne(id: number) {
    return `This action returns a #${id} link`;
  }

  update(id: number, updateLinkDto: UpdateLinkDto) {
    return `This action updates a #${id} link ${updateLinkDto}`;
  }

  remove(id: number) {
    return `This action removes a #${id} link`;
  }
}
