@chapter Conclusion

## Conclusion

The project set out to build a live air-quality platform for Indian cities and a station-level PM2.5 forecaster that is tested honestly against operational baselines. The first goal is met. AeroFusion fuses CAMS forecasts, weather, satellite fire detections, satellite imagery and the CPCB archive for 33 cities every 12 hours, shows them in a dashboard with a map, city views, driver analysis and history, and explains the current situation through an LLM analyst with a fallback chain. The platform labels model output as model output and has been running in deployment.

For the forecaster, the project built a leakage-safe benchmark for 116 CPCB stations in 28 cities: a fixed station panel, documented quality control, inputs limited by their real publication delays, causal wavelet bands, and test years locked by checksum and read by one script after model freeze. Every number in this report is read from run files. MW-AeroFusion-Net and its seven-rung ladder, twelve baselines including raw and bias-corrected CAMS, three input settings and six ablations are implemented, tested and trained on validation.

The validation results are mixed, and they are reported as measured. Station-level learning improves greatly on CAMS, whose error on the 2022 validation year is close to climatology. LightGBM and simple recurrent models are strong baselines. The full MW-AeroFusion-Net does not yet beat its simpler rungs or these baselines on validation. The five-seed runs and ablations now training will show which component causes the gap, and the final evaluation on 2023 to 2024 will give the test results. If the full model is still behind after the ablations, that is a useful finding for the field: on Indian station data at this scale, a well-built simple model with good inputs may be the better forecaster.

@pagebreak

## Future Work

- Complete the five-seed final runs and ablations, freeze the model as a team decision, and run the one-time test evaluation with significance tests, season and city breakdowns and episode scores.
- Run the four attribution checks on the frozen model and report each as passed or failed.
- Investigate the M6 gap: per-group gate summaries that keep the most recent hours, a warm start from M5, and stronger regularisation, all selected on validation only.
- Export the frozen model to ONNX and serve its forecasts in the live platform next to CAMS, with the model's validation and test errors shown to users.
- Score the prospective winter of 2026 to 2027 from live OpenAQ data as a true out-of-sample test.
- Add the five platform cities without a long-record station once their stations have enough history, and test a second rolling-origin fold.
- Prepare the IEEE conference paper from the frozen results after the guide's review.
