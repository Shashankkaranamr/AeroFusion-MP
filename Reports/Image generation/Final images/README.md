# Report figures

Approved style (20 Nov 2026):
- **Blue (#2F6EB5) is the only accent colour.** Every line, arrow, outline, shape, dotted group border, chart line and
  coloured label uses it. Titles are black and sub-lines grey.
- **Components:** the colour isometric components (anatomy skill), drawn large, each with its label directly underneath.
- **Size:** canvas 1400 px wide, made to be placed at full A4 text width (about 6.3 in) with text at about 9–10 pt.
  The charts are 6.3 in wide with 9–10 pt text.
- **Files:** transparent PNG at 3× resolution. Editable vector copies of the diagrams are in `svg/`.

Regenerate everything:

```
export PATH=/c/Users/PC-05/tools/node-v22.11.0-win-x64:$PATH
cd "Reports/Image generation"; for c in aq_station satellite server_rack gpu_workstation ground_antenna user_display; do node src/iso/$c.mjs --color; done
cd src/diagrams; python fig_systems.py; python fig_uml.py; python fig_model.py; python fig_misc.py; python fig_data.py
```

| File | Chapter / suggested caption |
|---|---|
| fig1_1_station_map.png | 1. CPCB stations used (116), upwind source regions (17) and platform cities without a station |
| fig1_2_system_overview.png | 1.7 Proposed system: public data, the live platform and MW-AeroFusion-Net, and the users |
| fig1_3_work_plan_gantt.png | 1.8 Work plan: planned phases (dashed) and actual progress (solid) |
| fig4_1_system_architecture.png | 4.1 High-level system architecture |
| fig4_2_mwafn_architecture.png | 4.2 MW-AeroFusion-Net architecture with tensor shapes |
| fig4_3_use_case.png | 4.3.1 Use-case diagram |
| fig4_4_class_diagram.png | 4.3.2 Class diagram |
| fig4_5_sequence_live.png | 4.3.3 Sequence diagram: 12-hour live refresh and a dashboard request |
| fig4_6_sequence_training.png | 4.3.3 Sequence diagram: data preparation, training and final evaluation |
| fig4_7_deployment.png | 4.1 / 4.5 Deployment diagram |
| fig4_8a_dfd_level0.png | 4.4 Data-flow diagram, level 0 |
| fig4_8b_dfd_level1.png | 4.4 Data-flow diagram, level 1 |
| fig4_9_data_design.png | 4.4 Data design: stores and the model batch |
| fig4_10_repository_structure.png | 4.5 Repository structure |
| fig5_1_methodology_flowchart.png | 5.3 Flowchart of the methodology |
| fig5_2_data_splits.png | 5.2 Train, validation and frozen test periods |
| fig5_3_latency_timeline.png | 5.4 Inputs available at issue time t0 |
| fig5_4_coverage_heatmap.png | 5.2 PM2.5 coverage per station and month, train and validation years (blue = gaps) |
| fig5_5_wavelet_bands.png | 5.4 Causal wavelet bands of one 72 h window (Delhi, Nov 2021, train year) |
| fig5_6_station_graph.png | 5.4 Station graph: 8 nearest neighbours within 600 km |
| fig5_7_model_ladder.png | 5.5 Model ladder M0 to M6 and the leave-one-out ablations |
| fig5_8_restart_safe_training.png | 3.8 / 5.6 Restart-safe training after a power cut |
| alg1_qc_and_windows.png | 5.4 Algorithm 1: quality control and latency-safe inputs |
| alg2_restart_safe_training.png | 5.4 Algorithm 2: restart-safe training with early stopping |
| fig6_1_ladder_validation.png | 6.1 Validation RMSE of the ladder and baselines (2022, seed 0, from metrics.json) |
| fig6_2_learning_curves.png | 6.1 Validation RMSE per epoch |
| components/*.png | colour isometric components (station, satellite, server rack, GPU workstation, antenna, dashboard terminal) |

Notes
- fig6_1 and fig6_2 are drawn from measured validation runs (`ml/runs/20261114-*-s0-e6b796e/metrics.json`). They are
  validation results only. Test-set figures are made only after `final_eval.py` has run.
- fig5_4 and fig5_5 read the train and validation years only. The code asserts that no time is at or after 2023-01-01.
- The map uses the Natural Earth India-view boundary (`ne_10m_admin_0_countries_ind`).
