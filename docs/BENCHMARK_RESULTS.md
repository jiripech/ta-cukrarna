# Performance Benchmark Results

## Test Environment

- **Date**: 24 October 2025
- **Repository**: jiripech/ta-cukrarna
- **Workflow**: Optimized v1.1.5+ (Next.js cache, parallel jobs)

## Machine Specifications

| Runner        | CPU                                | RAM   | Storage | Network    | Location |
| ------------- | ---------------------------------- | ----- | ------- | ---------- | -------- |
| GitHub Hosted | 2-core x86_64                      | 7GB   | SSD     | Fast       | Azure    |
| Mac Runner    | M1/M2                              | 16GB+ | NVMe    | Home ISP   | Local    |
| VPS Runner    | 2-core x86_64                      | 4GB   | SSD     | Datacenter | Europe   |
| NAS Runner    | Intel Atom C2538 @ 2.4GHz (4-core) | 8GB   | HDD/SSD | LAN        | Local    |

## Benchmark Results

### Pipeline Timing (in seconds)

| Stage          | GitHub | Mac | VPS | NAS | Winner |
| -------------- | ------ | --- | --- | --- | ------ |
| **Queue Time** | 0-30s  | ?   | ?   | ?   | TBD    |
| **Security**   | ?      | ?   | ?   | ?   | TBD    |
| **Lint**       | ?      | ?   | ?   | ?   | TBD    |
| **Build**      | ?      | ?   | ?   | ?   | TBD    |
| **Deploy**     | ?      | ?   | ?   | ?   | TBD    |
| **Verify**     | ?      | ?   | ?   | ?   | TBD    |
| **Total**      | ?      | ?   | ?   | ?   | TBD    |

### Performance Analysis

#### Security + Lint (Parallel)

- Expected: Mac fastest (M1/M2), GitHub second, VPS third

#### Build (npm ci + Next.js)

- Expected: Mac fastest (NVMe + M1), GitHub second
- Cache impact: Second builds should be much faster

#### Deploy (rsync to VPS)

- Expected: VPS fastest (localhost), GitHub second, Mac slowest

#### Verify (curl tests)

- Expected: VPS fastest (localhost), others similar

### Overall Findings

**Will be filled after benchmarks:**

- Best for development: ?
- Best for production: ?
- Most cost-effective: ?
- Most reliable: ?

### Recommendations

Based on results, we'll choose optimal runner for:

- Regular development builds
- Production releases
- Emergency hotfixes
- Cost optimization

---

_Results will be updated as we run benchmarks on each runner type._
