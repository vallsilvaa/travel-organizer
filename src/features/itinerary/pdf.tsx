import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type ItineraryPdfItem = {
  id: string;
  title: string;
  // Pre-formatted by the caller (e.g. "14:30–16:00" or "14:30"), since
  // combining start/end time is a data concern, not a layout one.
  timeRangeLabel: string | null;
  periodLabel: string | null;
  location: string | null;
  city: string | null;
  approxDistance: string | null;
  notes: string | null;
  linkedReservationTitles: string[];
};

export type ItineraryPdfDay = {
  heading: string;
  items: ItineraryPdfItem[];
};

export type ItineraryPdfLabels = {
  timeLabel: string;
  periodLabel: string;
  locationLabel: string;
  cityLabel: string;
  approxDistanceLabel: string;
  notesLabel: string;
  linkedReservationsLabel: string;
  emptyDayLabel: string;
};

export type ItineraryPdfInput = {
  tripTitle: string;
  tripDateRangeLabel: string;
  days: ItineraryPdfDay[];
  labels: ItineraryPdfLabels;
};

// Helvetica (react-pdf's built-in default, no font file to fetch or bundle)
// uses WinAnsiEncoding, which covers the accented characters pt-BR needs
// (á, ã, ç, é, ...) - so no custom font registration is needed here.
const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 36,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#0F172A",
  },
  tripTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
  },
  tripDateRange: {
    marginTop: 4,
    fontSize: 11,
    color: "#475569",
  },
  day: {
    marginTop: 18,
  },
  dayHeading: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#334155",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  emptyDay: {
    fontSize: 10,
    color: "#64748B",
  },
  item: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  itemTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  field: {
    flexDirection: "row",
    marginBottom: 2,
  },
  fieldLabel: {
    width: 110,
    color: "#64748B",
  },
  fieldValue: {
    flex: 1,
  },
});

function ItemField({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return null;
  }
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

export function buildItineraryPdfDocument({ tripTitle, tripDateRangeLabel, days, labels }: ItineraryPdfInput) {
  return (
    <Document title={tripTitle}>
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.tripTitle}>{tripTitle}</Text>
          <Text style={styles.tripDateRange}>{tripDateRangeLabel}</Text>
        </View>

        {days.map((day) => (
          <View key={day.heading} style={styles.day} wrap={false}>
            <Text style={styles.dayHeading}>{day.heading}</Text>
            {day.items.length ? (
              day.items.map((item) => (
                <View key={item.id} style={styles.item}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <ItemField label={labels.timeLabel} value={item.timeRangeLabel} />
                  <ItemField label={labels.periodLabel} value={item.periodLabel} />
                  <ItemField label={labels.locationLabel} value={item.location} />
                  <ItemField label={labels.cityLabel} value={item.city} />
                  <ItemField label={labels.approxDistanceLabel} value={item.approxDistance} />
                  <ItemField label={labels.notesLabel} value={item.notes} />
                  <ItemField
                    label={labels.linkedReservationsLabel}
                    value={item.linkedReservationTitles.length ? item.linkedReservationTitles.join(", ") : null}
                  />
                </View>
              ))
            ) : (
              <Text style={styles.emptyDay}>{labels.emptyDayLabel}</Text>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
}
