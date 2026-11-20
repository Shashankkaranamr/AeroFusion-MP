!table Leave-one-out ablations of MW-AeroFusion-Net on validation (2022, S-A, five seeds, µg/m³); Δ is the change in mean RMSE against the full model (negative = the variant is better) | ablation | 30,8,13,13,13,11,12
| Variant | Seeds | RMSE +1 h | RMSE +24 h | RMSE +48 h | Δ +1 h | Δ +24 h |
|---|---|---|---|---|---|---|
| M6 MW-AeroFusion-Net | 5 | 24.4 ± 4.3 | 35.3 ± 1.1 | 38.8 ± 0.5 | -- | -- |
| M6 without wavelet bands | 5 | 23.3 ± 3.1 | 34.7 ± 1.4 | 39.0 ± 2.2 | -1.1 | -0.6 |
| M6 without graph | 5 | 24.4 ± 4.1 | 34.9 ± 0.7 | 38.7 ± 0.3 | -0.0 | -0.4 |
| M6 with fixed graph only | 5 | 29.9 ± 9.4 | 37.0 ± 3.1 | 40.0 ± 2.6 | +5.4 | +1.8 |
| M6 without ConvLSTM | 5 | 25.1 ± 9.2 | 35.6 ± 3.6 | 38.8 ± 3.2 | +0.7 | +0.3 |
| M6 with GRU instead of Transformer | 5 | 23.0 ± 4.7 | 35.0 ± 0.9 | 39.2 ± 0.9 | -1.5 | -0.3 |
| M6 without gating | 5 | 21.2 ± 0.3 | 34.4 ± 0.9 | 38.1 ± 0.9 | -3.3 | -0.9 |
