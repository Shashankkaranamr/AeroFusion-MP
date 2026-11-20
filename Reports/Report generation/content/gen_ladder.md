!table Model ladder on validation (2022, S-A, seed 0): RMSE in µg/m³ and R² at +24 h | ladder | 24,15,9,9,9,9,11,14
| Rung | Parameters | RMSE +1 h | RMSE +24 h | RMSE +48 h | R² +24 h | Epochs | Train time (min) |
|---|---|---|---|---|---|---|---|
| M0 GRU | 43,248 | 22.5 | 33.6 | 37.5 | 0.667 | 12 | 22 |
| M1 + static graph | 84,336 | 21.8 | 34.1 | 37.4 | 0.657 | 11 | 21 |
| M2 + adaptive graph | 106,240 | 22.7 | 33.9 | 37.4 | 0.662 | 10 | 19 |
| M3 + Transformer | 152,384 | 23.6 | 34.3 | 37.7 | 0.653 | 12 | 24 |
| M4 + causal wavelet | 152,896 | 21.6 | 33.9 | 37.7 | 0.662 | 9 | 16 |
| M5 + ConvLSTM | 201,120 | 21.3 | 35.0 | 38.7 | 0.638 | 9 | 32 |
| M6 MW-AeroFusion-Net | 242,663 | 28.4 | 35.8 | 38.6 | 0.621 | 12 | 43 |
