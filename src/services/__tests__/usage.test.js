import { AppState } from 'react-native';
import { startUsagePings, stopUsagePings, trackScreen } from '../usage';
import { erpPing } from '../erpService';

jest.mock('../erpService', () => ({ erpPing: jest.fn() }));
jest.mock('../../storage/erpTokenStorage', () => ({ getErpToken: jest.fn(async () => 'tok') }));

const flush = () => new Promise((r) => setImmediate(r));
let onChange;

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, fn) => { onChange = fn; return { remove: jest.fn() }; });
});
afterEach(() => stopUsagePings());

it('sends screen views on backgrounding, and keeps them when the ping is not recorded', async () => {
    erpPing.mockResolvedValue({ ok: false });
    startUsagePings();
    await flush();
    trackScreen('TodayMain');
    trackScreen('TodayMain');          // a params change, not a second view
    trackScreen('SubjectDetail');

    onChange('background');
    await flush();
    expect(erpPing).toHaveBeenLastCalledWith('tok', { TodayMain: 1, SubjectDetail: 1 });

    erpPing.mockResolvedValue({ ok: true });
    onChange('active');
    await flush();
    expect(erpPing).toHaveBeenLastCalledWith('tok', { TodayMain: 1, SubjectDetail: 1 });

    onChange('background');
    await flush();
    expect(erpPing).toHaveBeenLastCalledWith('tok', {});
});
