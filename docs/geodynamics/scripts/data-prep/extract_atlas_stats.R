## extract_atlas_stats.R   (geodynamics)
##
## Climate / environment / hazard slice of the NZAVS data share for the
## Geodynamics scrolly. Sibling of context/sociodynamics/scripts/data-prep/
## extract_atlas_stats.R; same per-wave .sav loop, different item list and
## different geographic poolings.
##
## What we pull, per wave (T01–T16):
##   - Env.ClimateChgReal / Cause / Concern (climate belief + concern)
##   - Env.SatNZEnvironment, Env.SatWaterways (state of the environment)
##   - Env.Eff01/02, Env.EnvironmentValues, Env.EnvironmentNature (values)
##   - Env.SacWilling/Made/Norms, Env.RoutineWilling/Made (behaviour)
##   - Env.CarbonRegs, Env.MotorwaySpend, Env.PubTransSubs (policy)
##   - Env.Native.Species, Env.Possum.Control (conservation)
##   - Earthquake.Anxiety (hazard worry — only NZAVS hazard-worry item)
##   - E20111-E20115 (event experience: quake / flood / hurricane / fire)
##   - E31114, E31117 (global-worry list: natural disasters, climate change)
##   - NatChar21 ("appreciate nature and the outdoors", as a true-NZer trait)
##
## What NZAVS does NOT measure (confirmed by reading every wave's .inp):
##   - Ozone hole / UV concern         → ch9 stays pure-science.
##   - Sea level rise                  → no item.
##   - Volcanic-eruption worry         → no item (only event experience).
##   - Tsunami / flood / fire worry    → only experience flags, not anxiety.
##
## Groupings (same scaffolding as sociodynamics, plus hazard-relevant
## regional pools):
##   all · four priority ethnicities · three urban tiers (Rural_GCH) ·
##   ethnicity × urban-tier crosses · per-TA breakouts · pooled regions
##   for hazards (Canterbury / Wellington region / Bay of Plenty / TVZ /
##   East Cape / West Coast).
##
## Outputs to context/geodynamics/data/survey/:
##   atlas_stats_long.csv   wave × item × group rows (mean, n, sd, pct_agree)
##   atlas_stats.json       compact JSON the scrolly fetches (per-item arrays)
##   atlas_items.csv        item inventory + coverage map (debug)
##
## Run from repo root:
##   Rscript context/geodynamics/scripts/data-prep/extract_atlas_stats.R

suppressPackageStartupMessages({
  library(haven)
  library(dplyr)
  library(tidyr)
  library(purrr)
  library(stringr)
  library(jsonlite)
})

# ---- Config ------------------------------------------------------------

DATA_DIR <- "paper2/data/raw/NZAVS Data Share/00 Data Repository"
OUT_DIR  <- "context/geodynamics/data/survey"
dir.create(OUT_DIR, showWarnings = FALSE, recursive = TRUE)

# Wave → calendar year (start year of fieldwork)
WAVE_YEAR <- c(
  T01 = 2009, T02 = 2010, T03 = 2011, T035 = 2012, T04 = 2012,
  T05 = 2013, T06 = 2014, T07 = 2015, T08 = 2016, T09 = 2017,
  T10 = 2018, T11 = 2019, T12 = 2020, T13 = 2021, T14 = 2022,
  T15 = 2023, T16 = 2024
)

# Priority-coded ethnicity (NZAVS convention):
#   1 = NZ European, 2 = Māori, 3 = Pacific, 4 = Asian
ETH_LABEL <- c("1" = "nz_european", "2" = "maori", "3" = "pacific", "4" = "asian")

# Items, keyed by family. Stems get a wave suffix appended (".T01" etc.).
# NZAVS uses both `Env.Native.Species` and `Env.NATIVE.SPECIES` in different
# waves — we list both spellings so the wave-suffix lookup catches them.
ITEMS <- list(
  # Core climate-belief battery — present every wave
  climate_belief = c("Env.ClimateChgReal", "Env.ClimateChgCause"),
  # Concern enters at T05
  climate_concern = "Env.ClimateChgConcern",

  # State of the environment (satisfaction with NZ env / waterways)
  env_state = c("Env.SatNZEnvironment", "Env.SatWaterways"),

  # Personal environmental values + efficacy
  env_values = c("Env.EnvironmentValues", "Env.EnvironmentNature"),
  env_efficacy = c("Env.Eff01", "Env.Eff02"),

  # Pro-environmental behaviour (mostly early waves)
  env_behaviour = c("Env.SacWilling", "Env.SacMade", "Env.SacNorms",
                    "Env.RoutineWilling", "Env.RoutineMade"),

  # Environmental policy
  env_policy = c("Env.CarbonRegs", "Env.MotorwaySpend", "Env.PubTransSubs"),

  # Conservation. The SPSS column is `Env.NativeSpecies` (one word) in
  # every wave that carries it — the inp labels print it as
  # `Env.Native.Species` but that dotted form isn't a column. Possum.
  # Control appears in the Mplus syntax with the label
  # `Env.Possum.Control` but is not in the published SPSS Base Dataset,
  # so we leave it out.
  conservation = "Env.NativeSpecies",

  # Natural-hazard worry — the only NZAVS hazard-worry item
  hazard_worry = "Earthquake.Anxiety",

  # The E311xx "global issues" battery was tested in 2024 and dropped:
  # respondents pick the *single* issue that most worries them, so even
  # at the height of climate concern only ~0.3% select climate change
  # as the top one. The headline climate-worry number is far better
  # carried by Env.ClimateChgConcern (which we already have). We
  # explicitly do NOT pull E31114 / E31117 to avoid surfacing those
  # tiny percentages on the page.

  # Event-experience flags (E201xx). Coded as past-12-month occurrence:
  #   E20111 — Earthquake
  #   E20112 — Flooding
  #   E20113 — Hurricane
  #   E20114 — Bush fire
  #   E20115 — Other natural disaster
  event_experience = c("E20111", "E20112", "E20113", "E20114", "E20115"),

  # NatChar — what makes a true New Zealander. The published SPSS Base
  # Dataset carries only 8 of the original 22 NatChar items, in T07
  # alone. The "appreciate nature and the outdoors" item appears in the
  # Mplus syntax but never made it into the published columns; the
  # closest geo-relevant survivor is `NatChar.CleanGreen` ("to be from
  # a clean and green country"), which is the climate/environment
  # framing of national identity. Carried as a single-wave context
  # reading.
  outdoorsy = c("NatChar.CleanGreen", "NatChar.MaoriCulture")
)

# Demographic / cut variables to pull per wave when present
DEMO_STEMS <- c(
  "EthnicCats", "EthCat", "Ethnic.Cats",
  "MaoriAncestry", "BornNZ", "Census.Born.L1", "Citizen",
  "Age", "Cohort", "Gender", "GenderAll",
  "Census.MotherBorn.L1", "Census.FatherBorn.L1",
  "Immigrant.TimeNZYears", "SampleFrame",
  # Stats NZ urban-accessibility tier (post-T11; "Urban" pre-T11)
  "Rural_GCH", "Urban",
  # TA (territorial authority): boundaries are restated each census,
  # so we look up by vintage and fall back to whatever this wave has.
  "TA_2023", "TA_2022", "TA_2018", "TA_2016", "TA_2013", "TA_2010", "TA_2006",
  # Regional council (Canterbury / Wellington / BoP / etc.). 16 levels,
  # one of which directly is the geographic story we want — used as the
  # source for hazard regional pools.
  "REGC_2023", "REGC_2022", "REGC_2018", "REGC_2016", "REGC_2013", "REGC_2006"
)

# Per-family measurement scale. Drives the `pct_agree` threshold so the
# percentage stat is meaningful for each item type:
#   `agree_threshold`: a respondent counts as "agreeing" if value ≥ this.
#   For 1–7 Likert items this is the conventional 5 ("slightly agree").
#   For the 0–4 frequency-of-worry item (Earthquake.Anxiety) it's 2
#   ("sometimes" or higher). For binary tick-box items (worry-list,
#   event-experience) it's 1 — so pct_agree collapses to the raw share.
SCALES <- list(
  climate_belief   = list(max = 7, agree_threshold = 5),
  climate_concern  = list(max = 7, agree_threshold = 5),
  # NB: Env.SatNZEnvironment is scored 0-10 (1-10 in wave 1), not 1-7, so
  # max = 7 and the agree threshold are wrong for it; the page uses only the mean.
  env_state        = list(max = 7, agree_threshold = 5),
  env_values       = list(max = 7, agree_threshold = 5),
  env_efficacy     = list(max = 7, agree_threshold = 5),
  env_behaviour    = list(max = 7, agree_threshold = 5),
  env_policy       = list(max = 7, agree_threshold = 5),
  conservation     = list(max = 7, agree_threshold = 5),
  outdoorsy        = list(max = 7, agree_threshold = 5),
  hazard_worry     = list(max = 4, agree_threshold = 2),
  event_experience = list(max = 1, agree_threshold = 1)
)

# ---- Hazard-relevant regional poolings --------------------------------
#
# Two kinds of regional groupings:
#
# (A) REGC-based — one Stats NZ regional council level. Cleanest for the
#     hazard story because the boundaries match the actual region people
#     understand ("Canterbury", "Wellington Region", "Bay of Plenty").
#     Coverage runs from T01 onwards (REGC has been in NZAVS since the
#     start, under various boundary vintages).
#
# (B) TA-pooled — sub-regional groupings that don't align to a single
#     REGC. The Taupō Volcanic Zone in particular cuts across Waikato +
#     Bay of Plenty + Manawatū-Whanganui regional councils.

REGC_REGIONS <- list(
  # Christchurch earthquake region (4 Sept 2010, 22 Feb 2011, Kaikōura
  # 2016). Single REGC covers the lot.
  canterbury     = "Canterbury Region",
  # The Wellington Fault, with the 1855 Wairarapa quake as deep memory.
  wellington     = "Wellington Region",
  # White Island / Whakaari plus the eastern TVZ rim. Single REGC.
  bay_of_plenty  = "Bay of Plenty Region",
  # Auckland volcanic field — single REGC.
  auckland       = "Auckland Region",
  # Hikurangi subduction zone / East Cape tsunami source.
  gisborne       = "Gisborne Region",
  # Alpine Fault rupture story, the lurking "big one".
  west_coast     = "West Coast Region",
  # Other reference regions, useful as baselines / context lines.
  waikato        = "Waikato Region",
  otago          = "Otago Region",
  northland      = "Northland Region",
  hawkes_bay     = c("Hawke's Bay Region", "Hawke s Bay Region",
                     "Hawkes Bay Region")  # apostrophe varies by encoding
)

# Sub-regional TA pools (don't align to a single REGC)
TA_POOLS <- list(
  # Taupō Volcanic Zone — inland heart of NZ volcanism.
  tvz = c("Taupo District", "Taupō District", "Rotorua District",
          "Whakatane District", "Whakatāne District",
          "Ruapehu District", "South Waikato District",
          "Kawerau District", "Opotiki District", "Ōpōtiki District")
)

# Per-TA breakouts. The whitelist is geo-story-driven: every TA that
# carries a chapter beat (earthquake, volcanic, fault, coast).
TA_BREAKOUTS <- c(
  # Cities (anchors / baselines)
  "Auckland", "Wellington City", "Christchurch City", "Dunedin City",
  "Hamilton City", "Tauranga City", "Napier City", "Hastings District",
  "Lower Hutt City", "Upper Hutt City", "Porirua City",
  # Canterbury quake belt
  "Selwyn District", "Waimakariri District", "Hurunui District",
  "Ashburton District", "Kaikoura District", "Kaikōura District",
  # TVZ + BoP
  "Taupo District", "Taupō District", "Rotorua District",
  "Whakatane District", "Whakatāne District",
  "Western Bay of Plenty District",
  # Alpine Fault / West Coast
  "Buller District", "Grey District", "Westland District",
  # Far field tsunami / Hikurangi
  "Gisborne District", "Wairoa District",
  # Volcanic North Island
  "Ruapehu District", "South Waikato District"
)

# Rural_GCH groupings (mirrors sociodynamics extractor)
URB_HIGH    <- "High Urban Accessibility"
URB_MEDIUM  <- "Medium Urban Accessibility"
URB_LOW     <- c("Low Urban Accessibility", "Remote", "Very Remote")
URB_ANY     <- c(URB_HIGH, URB_MEDIUM, URB_LOW)

# Every family has a meaningful pct_agree under the SCALES spec above
# (the threshold differs by scale). No legacy AGREE_FAMILIES filter needed.

# ---- File discovery ----------------------------------------------------

files <- list.files(DATA_DIR,
                    pattern = "NZAVS T[0-9]+(\\.5)?.*SPSS Base Dataset\\.sav$",
                    full.names = TRUE)
# Skip the side files (economic games, scale validation)
files <- files[!grepl("Economic|Scale", files)]

# Wave label from filename: "T01" or "T035" (suffix used in the .sav columns)
wave_suffix <- function(f) {
  m <- str_match(basename(f), "T([0-9]+(?:\\.5)?)")[, 1]
  gsub("[.]", "", m)
}

# ---- Extraction --------------------------------------------------------

out_long <- list()
inventory <- list()

for (f in files) {
  suf <- wave_suffix(f)
  message("Reading ", suf, " ...")
  hdr <- read_sav(f, n_max = 0)
  nm <- names(hdr)

  wanted <- character(0)
  found_map <- list()
  for (fam in names(ITEMS)) {
    for (stem in ITEMS[[fam]]) {
      col <- paste0(stem, ".", suf)
      if (col %in% nm) {
        wanted <- c(wanted, col)
        found_map[[col]] <- list(family = fam, stem = stem, wave = suf)
      }
    }
  }
  demo_cols <- character(0)
  for (stem in DEMO_STEMS) {
    col <- paste0(stem, ".", suf)
    if (col %in% nm) demo_cols <- c(demo_cols, col)
  }
  if (length(wanted) == 0) {
    message("  no target columns; skipping")
    next
  }
  cols <- unique(c("Questionnaire.Num", demo_cols, wanted))
  d <- read_sav(f, col_select = all_of(cols))
  for (cc in wanted) d[[cc]] <- as.numeric(d[[cc]])

  # Ethnicity column for this wave
  eth_col <- intersect(
    c(paste0("EthnicCats.", suf), paste0("EthCat.", suf),
      paste0("Ethnic.Cats.", suf)),
    names(d)
  )
  eth <- if (length(eth_col) > 0) as.integer(d[[eth_col[1]]]) else
                                  rep(NA_integer_, nrow(d))

  # Geographic decode. Use whichever vintage of TA / REGC the wave
  # carries (boundaries are restated each census; the names map onto the
  # same regions for pooling purposes). Rural_GCH replaced `Urban` from
  # T11 onwards; we accept either.
  first_present <- function(stems) {
    for (s in stems) {
      col <- paste0(s, ".", suf)
      if (col %in% names(d)) return(col)
    }
    NA_character_
  }
  ta_col   <- first_present(c("TA_2023", "TA_2022", "TA_2018",
                              "TA_2016", "TA_2013", "TA_2010", "TA_2006"))
  regc_col <- first_present(c("REGC_2023", "REGC_2022", "REGC_2018",
                              "REGC_2016", "REGC_2013", "REGC_2006"))
  gch_col  <- first_present(c("Rural_GCH", "Urban"))
  ta   <- if (!is.na(ta_col))   as.character(as_factor(d[[ta_col]]))
          else rep(NA_character_, nrow(d))
  regc <- if (!is.na(regc_col)) as.character(as_factor(d[[regc_col]]))
          else rep(NA_character_, nrow(d))
  gch  <- if (!is.na(gch_col))  as.character(as_factor(d[[gch_col]]))
          else rep(NA_character_, nrow(d))

  # The pre-T11 "Urban" variable is just binary Urban / Rural — no
  # three-tier accessibility breakdown. Map onto URB_HIGH and the
  # rural bucket so the urban-tier groups carry through; the
  # urban_medium tier just stays empty in those early waves.
  if (!is.na(gch_col) && grepl("^Urban", gch_col)) {
    gch <- dplyr::case_when(
      grepl("^Urban", gch, ignore.case = TRUE) ~ URB_HIGH,
      grepl("^Rural", gch, ignore.case = TRUE) ~ "Low Urban Accessibility",
      TRUE                                     ~ NA_character_
    )
  }

  # ---- Build all groupings for this wave -----------------------------
  N <- nrow(d)
  groups <- list(
    all         = seq_len(N),
    nz_european = which(eth == 1),
    maori       = which(eth == 2),
    pacific     = which(eth == 3),
    asian       = which(eth == 4),
    # Urban tiers (whole sample)
    urban_high     = which(gch == URB_HIGH),
    urban_medium   = which(gch == URB_MEDIUM),
    urban_rural    = which(gch %in% URB_LOW),
    urban_combined = which(gch %in% c(URB_HIGH, URB_MEDIUM)),
    # Māori × urban-cut (two buckets only — sample size)
    maori_urban = which(eth == 2 & gch %in% c(URB_HIGH, URB_MEDIUM)),
    maori_rural = which(eth == 2 & gch %in% URB_LOW),
    # Pākehā × three-tier urban
    nzeur_high   = which(eth == 1 & gch == URB_HIGH),
    nzeur_medium = which(eth == 1 & gch == URB_MEDIUM),
    nzeur_rural  = which(eth == 1 & gch %in% URB_LOW)
  )
  # REGC-based regional pools (the main hazard cuts)
  for (rname in names(REGC_REGIONS)) {
    groups[[paste0("region_", rname)]] <- which(regc %in% REGC_REGIONS[[rname]])
  }
  # Rest-of-NZ buckets, for "X vs rest" comparisons in the hazard story.
  for (rname in c("canterbury", "wellington", "bay_of_plenty", "auckland")) {
    groups[[paste0("region_outside_", rname)]] <-
      which(!regc %in% REGC_REGIONS[[rname]] & !is.na(regc))
  }
  # Sub-regional TA pools (TVZ doesn't align to a single REGC)
  for (pname in names(TA_POOLS)) {
    groups[[paste0("region_", pname)]] <- which(ta %in% TA_POOLS[[pname]])
  }
  # Per-TA breakouts (one row per TA in TA_BREAKOUTS)
  for (this_ta in TA_BREAKOUTS) {
    key <- paste0("ta_", tolower(gsub("[^A-Za-z0-9]+", "_", this_ta)))
    groups[[key]] <- which(ta == this_ta)
  }

  summarise_item <- function(values, group_idx, group_label, threshold) {
    v <- values[group_idx]
    v <- v[!is.na(v)]
    if (length(v) < 30) {  # suppress tiny cells
      return(tibble(group = group_label, mean = NA_real_, sd = NA_real_,
                    n = length(v), pct_agree = NA_real_))
    }
    tibble(
      group     = group_label,
      mean      = mean(v),
      sd        = sd(v),
      n         = length(v),
      pct_agree = mean(v >= threshold)
    )
  }

  for (col in wanted) {
    fam  <- found_map[[col]]$family
    stem <- found_map[[col]]$stem
    vals <- d[[col]]
    threshold <- SCALES[[fam]]$agree_threshold

    rows <- list()
    for (g_name in names(groups)) {
      rows[[length(rows) + 1]] <- summarise_item(vals, groups[[g_name]],
                                                  g_name, threshold)
    }
    rows <- bind_rows(rows)
    rows$wave   <- suf
    rows$family <- fam
    rows$item   <- stem
    out_long[[length(out_long) + 1]] <- rows
  }
  inventory[[suf]] <- tibble(wave = suf, item = vapply(found_map, `[[`, "",
                                                       "stem"))
}

out <- bind_rows(out_long)

# Add calendar year
out$year <- WAVE_YEAR[out$wave]

# Reorder columns
out <- out[, c("wave", "year", "family", "item", "group",
               "mean", "sd", "n", "pct_agree")]

# ---- Write outputs -----------------------------------------------------

write.csv(out, file.path(OUT_DIR, "atlas_stats_long.csv"),
          row.names = FALSE)

# Compact JSON: item-keyed at the top, with `family` + per-group series.
# Same shape as sociodynamics atlas_stats.json so the JS modules port
# unchanged.

json_payload <- list()
items <- unique(out$item)
for (it in items) {
  d_it <- out[out$item == it, ]
  fam  <- d_it$family[1]
  groups <- list()
  for (g in unique(d_it$group)) {
    d_g <- d_it[d_it$group == g, ]
    d_g <- d_g[order(d_g$year), ]
    groups[[g]] <- data.frame(
      wave      = d_g$wave,
      year      = d_g$year,
      mean      = round(d_g$mean, 3),
      n         = d_g$n,
      pct_agree = round(d_g$pct_agree, 3),
      stringsAsFactors = FALSE
    )
  }
  json_payload[[it]] <- list(family = fam, groups = groups)
}

write(toJSON(json_payload, dataframe = "rows", na = "null",
             auto_unbox = TRUE, pretty = FALSE),
      file.path(OUT_DIR, "atlas_stats.json"))

# Inventory of which items appeared in which waves (debug aid)
inv <- bind_rows(inventory) |>
  distinct() |>
  arrange(item, wave)
write.csv(inv, file.path(OUT_DIR, "atlas_items.csv"), row.names = FALSE)

message("\nWrote:")
message("  ", file.path(OUT_DIR, "atlas_stats_long.csv"))
message("  ", file.path(OUT_DIR, "atlas_stats.json"))
message("  ", file.path(OUT_DIR, "atlas_items.csv"))
message("Rows: ", nrow(out), "   distinct items: ",
        length(unique(out$item)))
