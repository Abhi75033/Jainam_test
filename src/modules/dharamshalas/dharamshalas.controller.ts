import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import * as dharamshalaService from './dharamshalas.service';

export const createBuilding = asyncHandler(async (req: Request, res: Response) => {
  const building = await dharamshalaService.createBuilding(req.params.organizationId as string, req.body.name);
  return created(res, building);
});

export const createWing = asyncHandler(async (req: Request, res: Response) => {
  const wing = await dharamshalaService.createWing(req.params.buildingId as string, req.body.name, req.body.floor);
  return created(res, wing);
});

export const createRoom = asyncHandler(async (req: Request, res: Response) => {
  const room = await dharamshalaService.createRoom(req.params.wingId as string, req.body);
  return created(res, room);
});

export const updateRoom = asyncHandler(async (req: Request, res: Response) => {
  const room = await dharamshalaService.updateRoom(req.params.roomId as string, req.body);
  return ok(res, room);
});

export const getStructure = asyncHandler(async (req: Request, res: Response) => {
  const structure = await dharamshalaService.getStructure(req.params.organizationId as string);
  return ok(res, structure);
});
