!table Validation errors (2022, station level, µg/m³), setting S-A, seed 0 | val-sa | 30,10,10,10,10,10,10
| Model | RMSE +1 h | RMSE +24 h | RMSE +48 h | MAE +1 h | MAE +24 h | MAE +48 h |
|---|---|---|---|---|---|---|
| Persistence | 23.8 | 39.3 | 45.5 | 13.0 | 22.6 | 26.8 |
| Same hour yesterday | 38.6 | 44.8 | 47.6 | 22.4 | 26.3 | 28.5 |
| Climatology | 45.4 | 44.5 | 44.5 | 29.3 | 28.6 | 28.6 |
| LightGBM (S-A) | 25.0 | 34.2 | 37.1 | 14.3 | 20.3 | 22.4 |
| LSTM | 22.1 | 34.7 | 38.2 | 12.9 | 20.1 | 22.7 |
| CNN-LSTM | 22.7 | 33.6 | 37.9 | 13.8 | 20.1 | 22.9 |
| ConvLSTM | 32.3 | 36.9 | 39.1 | 18.7 | 22.0 | 24.2 |
| PM2.5-GNN (past met.) | 21.9 | 34.5 | 38.0 | 12.7 | 20.4 | 23.0 |
| Graph WaveNet | 22.5 | 35.2 | 39.4 | 13.3 | 21.0 | 23.8 |
| M6 MW-AeroFusion-Net | 28.4 | 35.8 | 38.6 | 16.3 | 21.7 | 23.5 |
