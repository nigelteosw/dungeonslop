import { gridToWorld, boardCenter } from './gridToWorld';

test('gridToWorld maps grid to x/z plane', () => {
  expect(gridToWorld({ x: 3, y: 5 })).toEqual([3, 0, 5]);
});

test('boardCenter of 16x16', () => {
  expect(boardCenter(16, 16)).toEqual([7.5, 0, 7.5]);
});
