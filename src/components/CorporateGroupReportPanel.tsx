import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';
import { formatCurrency } from '../utils/format';
import { CORPORATE_DEPARTMENT_DEFINITIONS } from '../engine/businessWorkforceEngine';
import {
  CorporateKpiStatus,
  CorporateReportPeriod,
} from '../engine/corporateReportingEngine';
import { CorporateGroupManagementReport } from '../engine/corporateGroupReportingEngine';
import { CorporateDepartmentId } from '../types/game';

function statusColor(status: CorporateKpiStatus): string {
  if (status === 'critical') return Colors.negative;
  if (status === 'watch') return Colors.warning;
  if (status === 'healthy') return Colors.primary;
  return Colors.textMuted;
}

function statusLabel(status: CorporateKpiStatus): string {
  if (status === 'critical') return 'Action needed';
  if (status === 'watch') return 'Watch';
  if (status === 'healthy') return 'Healthy';
  return 'Baseline';
}

function Metric({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: string;
  detail: string;
  status: CorporateKpiStatus;
}) {
  const color = statusColor(status);
  return (
    <View style={styles.metric}>
      <View style={styles.metricLabelRow}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </View>
  );
}

export default function CorporateGroupReportPanel({
  quarterlyReport,
  annualReport,
  period,
  onPeriodChange,
  showPeriodToggle = true,
  onCompanyPress,
}: {
  quarterlyReport: CorporateGroupManagementReport;
  annualReport: CorporateGroupManagementReport;
  period: CorporateReportPeriod;
  onPeriodChange: (period: CorporateReportPeriod) => void;
  showPeriodToggle?: boolean;
  onCompanyPress?: (businessId: string) => void;
}) {
  const report = period === 'quarter' ? quarterlyReport : annualReport;
  const color = statusColor(report.overallStatus);
  const revenueTrend = report.revenuePerEmployeeChangePct == null
    ? 'Baseline forming'
    : `${report.revenuePerEmployeeChangePct >= 0 ? '+' : ''}${(report.revenuePerEmployeeChangePct * 100).toFixed(1)}% vs prior`;
  const turnoverTrend = report.turnoverTrend === 'baseline'
    ? 'Baseline forming'
    : `${report.turnoverTrend} vs prior`;
  const coverage = Math.round(report.reportingValueCoverage * 100);
  const concentration = Math.max(report.valueConcentration, report.revenueConcentration);

  return (
    <>
      <View style={styles.header}>
        {showPeriodToggle ? (
          <View style={styles.tabs}>
            <Pressable
              onPress={() => onPeriodChange('quarter')}
              style={[styles.tab, period === 'quarter' && styles.tabActive]}
            >
              <Text style={[styles.tabText, period === 'quarter' && { color: Colors.info }]}>Quarter</Text>
            </Pressable>
            <Pressable
              onPress={() => onPeriodChange('annual')}
              style={[styles.tab, period === 'annual' && styles.tabActive]}
            >
              <Text style={[styles.tabText, period === 'annual' && { color: Colors.info }]}>Annual</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.period}>Consolidated</Text>
        )}
        <View style={styles.status}>
          <View style={[styles.statusDot, { backgroundColor: color }]} />
          <Text style={[styles.statusText, { color }]}>{statusLabel(report.overallStatus)}</Text>
        </View>
      </View>

      <View style={styles.coverageRow}>
        <View>
          <Text style={styles.period}>{report.label}</Text>
          <Text style={styles.coverageText}>
            {report.reportingCompanyCount}/{report.companyCount} companies reporting • {coverage}% of portfolio value
          </Text>
        </View>
        <Text style={styles.weeks}>{report.weeksTracked}/{report.expectedWeeks}w</Text>
      </View>

      <View style={styles.grid}>
        <Metric
          label="Productivity"
          value={`${report.productivityIndex.toFixed(0)}%`}
          detail="Headcount-weighted"
          status={report.productivityStatus}
        />
        <Metric
          label="Revenue / employee"
          value={`${formatCurrency(report.revenuePerEmployee)}/wk`}
          detail={revenueTrend}
          status={report.revenuePerEmployeeStatus}
        />
        <Metric
          label="Payroll / revenue"
          value={`${(report.payrollToRevenueRatio * 100).toFixed(1)}%`}
          detail="Watch >32% • Critical >45%"
          status={report.payrollStatus}
        />
        <Metric
          label="Turnover"
          value={`${(report.annualizedTurnoverRate * 100).toFixed(1)}%`}
          detail={turnoverTrend}
          status={report.turnoverStatus}
        />
        <Metric
          label="Debt coverage"
          value={report.debtCoverage == null ? 'No debt' : `${report.debtCoverage.toFixed(2)}×`}
          detail={report.debtCoverage == null ? 'No scheduled debt service' : 'Watch <1.5×'}
          status={report.debtCoverageStatus}
        />
        <Metric
          label="Maintenance"
          value={`${report.averageMaintenanceCondition.toFixed(0)}%`}
          detail={`${formatCurrency(report.maintenanceBacklog)} backlog`}
          status={report.maintenanceStatus}
        />
        <Metric
          label="Project ROI"
          value={report.projectOperatingRoi == null ? 'No projects' : `${(report.projectOperatingRoi * 100).toFixed(1)}%`}
          detail={report.projectOperatingRoi == null
            ? 'No completed corporate capex'
            : `${formatCurrency(report.projectAnnualOperatingBenefit)}/yr direct benefit`}
          status={report.projectRoiStatus}
        />
      </View>

      <Text style={styles.subheading}>Department productivity</Text>
      <View style={styles.departments}>
        {(Object.keys(CORPORATE_DEPARTMENT_DEFINITIONS) as CorporateDepartmentId[]).map((departmentId) => {
          const definition = CORPORATE_DEPARTMENT_DEFINITIONS[departmentId];
          const value = report.departmentProductivity[departmentId] ?? 100;
          const status: CorporateKpiStatus = value < 85 ? 'critical' : value < 95 ? 'watch' : 'healthy';
          return (
            <View key={departmentId} style={styles.department}>
              <Text style={styles.departmentIcon}>{definition.icon}</Text>
              <Text style={styles.departmentName}>{definition.name}</Text>
              <Text style={[styles.departmentValue, { color: statusColor(status) }]}>{value.toFixed(0)}%</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.riskBox}>
        <View style={styles.riskItem}>
          <Text style={styles.riskLabel}>Leverage</Text>
          <Text style={[styles.riskValue, {
            color: report.leverageRatio > 0.70 ? Colors.negative : report.leverageRatio > 0.50 ? Colors.warning : Colors.textPrimary,
          }]}>
            {(report.leverageRatio * 100).toFixed(0)}%
          </Text>
        </View>
        <View style={styles.riskItem}>
          <Text style={styles.riskLabel}>Concentration</Text>
          <Text style={[styles.riskValue, {
            color: concentration > 0.80 ? Colors.negative : concentration > 0.65 ? Colors.warning : Colors.textPrimary,
          }]}>
            {(concentration * 100).toFixed(0)}%
          </Text>
        </View>
        <View style={styles.riskItem}>
          <Text style={styles.riskLabel}>Loss-making</Text>
          <Text style={[styles.riskValue, {
            color: report.lossMakingCompanies > 0 ? Colors.warning : Colors.primary,
          }]}>
            {report.lossMakingCompanies}/{report.companyCount}
          </Text>
        </View>
      </View>

      {report.priorityCompanies.length > 0 && (
        <View style={styles.priorityBox}>
          <View style={styles.priorityHeader}>
            <Text style={styles.priorityTitle}>Priority companies</Text>
            <Text style={[styles.priorityCount, { color }]}>
              {report.priorityCompanies.length}
            </Text>
          </View>
          {report.priorityCompanies.slice(0, 3).map((company) => (
            <Pressable
              key={company.businessId}
              disabled={!onCompanyPress}
              onPress={() => onCompanyPress?.(company.businessId)}
              style={styles.priorityRow}
            >
              <View style={[styles.priorityBar, { backgroundColor: statusColor(company.status) }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.priorityCompany}>{company.businessName}</Text>
                <Text style={styles.priorityReason}>
                  {company.topWarning ?? 'Management review required'}
                </Text>
              </View>
              <View style={styles.priorityMeta}>
                <Text style={[styles.priorityStatus, { color: statusColor(company.status) }]}>
                  {company.criticalWarningCount > 0
                    ? `${company.criticalWarningCount} critical`
                    : `${company.warningCount} flags`}
                </Text>
                {onCompanyPress && (
                  <Text style={styles.priorityChevron}>›</Text>
                )}
              </View>
            </Pressable>
          ))}
          {report.priorityCompanies.length > 3 && (
            <Text style={styles.moreFlags}>+{report.priorityCompanies.length - 3} more priority companies</Text>
          )}
        </View>
      )}

      <View style={styles.flags}>
        <View style={styles.flagsHeader}>
          <Text style={styles.flagsTitle}>Group flags</Text>
          <Text style={[styles.flagsCount, { color }]}>
            {report.warnings.length === 0 ? 'None' : report.warnings.length}
          </Text>
        </View>
        {report.warnings.length === 0 ? (
          <Text style={styles.allClear}>No group-level management threshold is currently breached.</Text>
        ) : (
          <>
            {report.warnings.slice(0, 3).map((warning) => (
              <View key={warning.id} style={styles.flagRow}>
                <View style={[styles.flagBar, { backgroundColor: statusColor(warning.severity) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.flagTitle}>{warning.title}</Text>
                  <Text style={styles.flagDetail}>{warning.detail}</Text>
                </View>
              </View>
            ))}
            {report.warnings.length > 3 && (
              <Text style={styles.moreFlags}>+{report.warnings.length - 3} more flags</Text>
            )}
          </>
        )}
      </View>

      <Text style={styles.footnote}>
        Reporting covers companies with corporate workforce data. Concentration, leverage and loss-making counts use the full selected portfolio.
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tabs: { flexDirection: 'row', padding: 2, backgroundColor: Colors.elevated, borderRadius: 9 },
  tab: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 },
  tabActive: { backgroundColor: Colors.card, borderWidth: 1, borderColor: `${Colors.info}55` },
  tabText: { color: Colors.textMuted, fontSize: 8, fontWeight: '900' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 9, fontWeight: '900' },
  coverageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8, marginTop: 8 },
  period: { color: Colors.textPrimary, fontSize: 10, fontWeight: '900' },
  coverageText: { color: Colors.textMuted, fontSize: 8, marginTop: 2 },
  weeks: { color: Colors.textMuted, fontSize: 8, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  metric: { width: '48.8%', minHeight: 65, borderRadius: 9, backgroundColor: Colors.elevated, paddingHorizontal: 8, paddingVertical: 8 },
  metricLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  metricLabel: { color: Colors.textSecondary, fontSize: 8, fontWeight: '800' },
  metricValue: { fontSize: 12, fontWeight: '900', marginTop: 4 },
  metricDetail: { color: Colors.textMuted, fontSize: 7, lineHeight: 10, marginTop: 2 },
  subheading: { color: Colors.textPrimary, fontSize: 9, fontWeight: '900', marginTop: 11, marginBottom: 6 },
  departments: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  department: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: '31%', borderRadius: 8, borderWidth: 1, borderColor: Colors.cardBorder, paddingHorizontal: 7, paddingVertical: 6 },
  departmentIcon: { fontSize: 10 },
  departmentName: { flex: 1, color: Colors.textSecondary, fontSize: 7 },
  departmentValue: { fontSize: 8, fontWeight: '900' },
  riskBox: { flexDirection: 'row', gap: 6, marginTop: 10 },
  riskItem: { flex: 1, backgroundColor: Colors.elevated, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7 },
  riskLabel: { color: Colors.textMuted, fontSize: 7 },
  riskValue: { fontSize: 11, fontWeight: '900', marginTop: 2 },
  priorityBox: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder, marginTop: 10, paddingTop: 8 },
  priorityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priorityTitle: { color: Colors.textPrimary, fontSize: 9, fontWeight: '900' },
  priorityCount: { fontSize: 8, fontWeight: '900' },
  priorityRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 7 },
  priorityBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  priorityCompany: { color: Colors.textPrimary, fontSize: 8, fontWeight: '800' },
  priorityReason: { color: Colors.textMuted, fontSize: 7, lineHeight: 10, marginTop: 1 },
  priorityMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priorityStatus: { fontSize: 7, fontWeight: '900' },
  priorityChevron: { color: Colors.textMuted, fontSize: 15, lineHeight: 15 },
  flags: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder, marginTop: 10, paddingTop: 8 },
  flagsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  flagsTitle: { color: Colors.textPrimary, fontSize: 9, fontWeight: '900' },
  flagsCount: { fontSize: 8, fontWeight: '900' },
  allClear: { color: Colors.textSecondary, fontSize: 8, lineHeight: 12, marginTop: 6 },
  flagRow: { flexDirection: 'row', gap: 7, marginTop: 7 },
  flagBar: { width: 3, borderRadius: 2 },
  flagTitle: { color: Colors.textPrimary, fontSize: 8, fontWeight: '800' },
  flagDetail: { color: Colors.textMuted, fontSize: 7, lineHeight: 10, marginTop: 1 },
  moreFlags: { color: Colors.warning, fontSize: 7, fontWeight: '800', marginTop: 6 },
  footnote: { color: Colors.textMuted, fontSize: 7, lineHeight: 10, marginTop: 8, fontStyle: 'italic' },
});
