# Extracted CLD3 parameters

`cld3-parameters.npz` contains the 16 released embedding, scale, dense-weight
and bias arrays from Google's `src/lang_id_nn_params.cc`, without changing their
values. It is an inspection artifact; use the optional CLD3 WASM provider for
actual language identification. It does not contain the feature pipeline or
language-label mapping.

Google's type named `float16` is **truncated FP32 with bfloat16 bit layout**,
not IEEE FP16. Scale arrays therefore remain uint16 raw bits. Decode them as:

```python
import numpy as np
with np.load('inspection/cld3-parameters.npz', allow_pickle=False) as arrays:
    bits = arrays['kEmbeddingsQuantScales0'].astype('<u4') << 16
    scales = bits.view('<f4')
```

Source, dimensions and implementation:

- https://github.com/google/cld3/blob/master/src/lang_id_nn_params.cc
- https://github.com/google/cld3/blob/master/src/float16.h
- https://github.com/google/cld3/blob/master/src/embedding_network.cc

Recreate with `python scripts/inspect_cld3.py PATH_TO_lang_id_nn_params.cc
--output reports/cld3-parameters.json --npz inspection/cld3-parameters.npz`.
The script verifies the downloaded source SHA-256 before parsing it.

Copyright 2016 Google Inc. Apache-2.0; see
`licenses/CLD3-Apache-2.0.txt` and `NOTICE.md`.
