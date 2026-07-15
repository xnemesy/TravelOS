import { OptimizationReportFormatter } from './OptimizationReportFormatter';

describe('OptimizationReportFormatter.generateWhyDayWorks', () => {
  it('returns evening arrival text when real visits count is 0 and start time is evening or arrival anchor present', () => {
    const places = [
      { id: 'arr', name: 'Arrivo in Volo', journeyAnchorKind: 'arrival_flight', scheduledTime: '23:30', category: 'flight' },
      { id: 'trans', name: 'Trasferimento', journeyAnchorKind: 'arrival_transfer', scheduledTime: '23:30', category: 'transfer' },
      { id: 'checkin', name: 'Check-in Hotel', journeyAnchorKind: 'arrival_check_in', scheduledTime: '23:59', category: 'check_in' },
    ];

    const report = OptimizationReportFormatter.generateWhyDayWorks(places);
    expect(report).toContain("Oggi il viaggio è dedicato all'arrivo. Hai poco tempo utile prima della notte");
  });

  it('returns morning start text when visits start in the morning (< 14:00)', () => {
    const places = [
      { id: 'mus', name: 'Museo Archeologico', scheduledTime: '09:30', category: 'museum', calculatedStartTime: '09:30' },
    ];

    const report = OptimizationReportFormatter.generateWhyDayWorks(places);
    expect(report).toContain('perché apre presto al mattino ed è il momento ideale per visitarlo');
  });

  it('returns afternoon start text when visits start in the afternoon (>= 14:00)', () => {
    const places = [
      { id: 'piazza', name: 'Piazza Maggiore', scheduledTime: '15:00', category: 'attraction', calculatedStartTime: '15:00' },
    ];

    const report = OptimizationReportFormatter.generateWhyDayWorks(places);
    expect(report).toContain('come prima tappa del pomeriggio/serata per sfruttare al meglio le ore disponibili');
  });
});
