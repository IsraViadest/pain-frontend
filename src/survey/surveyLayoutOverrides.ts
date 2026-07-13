/** Dev-only overrides for blob layout tuning (`?surveyDebug=1`). `null` → use surveyData constant. */

export const surveyLayoutOverrides = {
  bubbleGapPx: null as number | null,
  layoutMaxIterations: null as number | null,
  fieldInsetFrac: null as number | null,
  initCellOffsetFrac: null as number | null,
};

/** Reset all layout overrides (debug panel cleanup). */
export function resetSurveyLayoutOverrides(): void {
  surveyLayoutOverrides.bubbleGapPx = null;
  surveyLayoutOverrides.layoutMaxIterations = null;
  surveyLayoutOverrides.fieldInsetFrac = null;
  surveyLayoutOverrides.initCellOffsetFrac = null;
}
