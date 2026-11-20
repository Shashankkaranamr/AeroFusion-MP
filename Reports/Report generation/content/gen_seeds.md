!table Validation RMSE over five seeds (2022, station level, µg/m³, mean ± sd) and Diebold-Mariano p-values against LightGBM MOS | seeds | 28,8,13,13,13,12,13
| Model | Seeds | RMSE +1 h | RMSE +24 h | RMSE +48 h | DM p +24 h | DM p +48 h |
|---|---|---|---|---|---|---|
| Persistence | 1 | 23.8 | 39.3 | 45.5 | 0.000 (worse) | 0.000 (worse) |
| Climatology | 1 | 45.4 | 44.5 | 44.5 | 0.000 (worse) | 0.000 (worse) |
| CAMS + bias correction | 1 | 46.9 | 47.1 | 46.8 | 0.000 (worse) | 0.000 (worse) |
| LightGBM (S-A) | 1 | 25.0 | 34.2 | 37.1 | 0.415 | 0.007 (worse) |
| LightGBM MOS (S-B) | 1 | 24.7 | 33.8 | 35.4 | -- | -- |
| LSTM | 5 | 22.2 ± 0.5 | 34.6 ± 0.2 | 38.3 ± 0.4 | 0.033 (worse) | 0.000 (worse) |
| CNN-LSTM | 5 | 22.3 ± 0.3 | 34.1 ± 0.4 | 38.4 ± 0.7 | 0.441 | 0.000 (worse) |
| PM2.5-GNN (past met.) | 5 | 22.0 ± 0.4 | 34.1 ± 0.3 | 38.0 ± 0.3 | 0.472 | 0.000 (worse) |
| Graph WaveNet | 5 | 22.2 ± 0.7 | 34.3 ± 0.7 | 38.5 ± 1.0 | 0.235 | 0.000 (worse) |
| M6 MW-AeroFusion-Net | 5 | 24.4 ± 4.3 | 35.3 ± 1.1 | 38.8 ± 0.5 | 0.016 (worse) | 0.000 (worse) |
| MW-AeroFusion-Net (S-B) | 5 | 35.1 ± 0.6 | 37.6 ± 0.8 | 38.4 ± 0.9 | 0.000 (worse) | 0.000 (worse) |
