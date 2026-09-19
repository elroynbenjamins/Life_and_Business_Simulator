import React from 'react';
import { act, render, fireEvent } from '@testing-library/react-native';
import GameDialog, { showGameDialog } from '../GameDialog';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

describe('game dialog options', () => {
  test('new confirmations do not inherit Sell All from a previous dialog', () => {
    const view = render(<GameDialog />);
    act(() => showGameDialog({ title: 'Sell stocks', message: 'Sell?', confirmText: 'Sell All', destructive: true, onConfirm: jest.fn() }));
    act(() => showGameDialog({ title: 'Auction', message: 'Bid?', confirmText: 'Bid', onConfirm: jest.fn() }));
    expect(view.queryByText('Sell All')).toBeNull();
    expect(view.getByText('Bid')).toBeTruthy();
    act(() => showGameDialog({ title: 'Next action', message: 'Proceed?', onConfirm: jest.fn() }));
    expect(view.queryByText('Bid')).toBeNull();
    expect(view.getByText('Confirm')).toBeTruthy();
  });
  test('an informational dialog does not retain an old purchase callback', () => {
    const action = jest.fn();
    const view = render(<GameDialog />);
    act(() => showGameDialog({ title: 'Purchase', message: 'Buy?', onConfirm: action }));
    act(() => showGameDialog({ title: 'Notice', message: 'Information only' }));
    expect(view.queryByText('Cancel')).toBeNull();
    fireEvent.press(view.getByText('OK'));
    expect(action).not.toHaveBeenCalled();
  });
});
