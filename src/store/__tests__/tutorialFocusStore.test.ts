import { useTutorialFocusStore as store } from '../tutorialFocusStore';

beforeEach(() => store.getState().clear());
test('a late measurement cannot settle a newer request', () => {
  store.getState().locate('home.cashflow');
  const old = store.getState().request;
  store.getState().locate('education.enroll');
  store.getState().report(old, 'located');
  expect(store.getState().status).toBe('locating');
  expect(store.getState().target).toBe('education.enroll');
});
test('manual drag or timeout cannot be reversed by a late native callback', () => {
  for (const status of ['cancelled', 'unavailable'] as const) {
    store.getState().locate('home.advance');
    const request = store.getState().request;
    store.getState().report(request, status);
    store.getState().report(request, 'located');
    expect(store.getState().status).toBe(status);
  }
});
test('Show me can retry after a missing target', () => {
  store.getState().locate('education.enroll');
  const request = store.getState().request;
  store.getState().report(request, 'unavailable');
  store.getState().locate('education.enroll');
  expect(store.getState().request).toBeGreaterThan(request);
  expect(store.getState().status).toBe('locating');
});
test('pausing invalidates pending requests and removes navigation emphasis', () => {
  store.getState().locate('home.advance');
  store.setState({ navigationRoute: '/tabs' });
  const request = store.getState().request;
  store.getState().clear();
  store.getState().report(request, 'located');
  expect(store.getState().status).toBe('idle');
  expect(store.getState().target).toBeNull();
  expect(store.getState().navigationRoute).toBeNull();
});
