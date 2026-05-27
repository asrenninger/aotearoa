## extract_atlas_stats.R
##
## Pull a small, scrolly-shaped slice out of the full NZAVS data share.
##
## For each per-wave .sav (T01–T16), we extract just the items keyed to the
## chapter crosswalk (warmth, contact, threat, anxiety, historical negation,
## symbolic exclusion, bicultural policy, immigration policy,
## multiculturalism, national identity, patriotism, te reo, the Māori
## sociopolitical-consciousness battery, the Pacific wellbeing battery),
## then compute per-wave summaries — overall and split by priority ethnicity.
##
## Output goes to context/sociodynamics/data/survey/ :
##   atlas_stats_long.csv   wave × item × group rows (mean, n, sd, pct_agree)
##   atlas_stats.json       compact JSON the scrolly fetches (per-item arrays)
##   atlas_items.json       item inventory + coverage map (debug)
##
## Run from repo root:
##   Rscript context/sociodynamics/scripts/data-prep/extract_atlas_stats.R

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
OUT_DIR  <- "context/sociodynamics/data/survey"
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

# Items, keyed by chapter-relevant family. Stems get a wave suffix appended.
ITEMS <- list(
  # Four-group inter-ethnic battery
  warmth = c("Warm.NZEuro", "Warm.Maori", "Warm.Pacific", "Warm.Asians",
             "Warm.Chinese", "Warm.Indians", "Warm.Muslims", "Warm.Arabs",
             "Warm.Immigrants", "Warm.Refugees",
             "Warm.Americans", "Warm.Overweight", "Warm.Ingroup"),
  contact_hours = c("Hours.NZEuroFRD", "Hours.MaoriFRD",
                    "Hours.PacificFRD", "Hours.AsiansFRD",
                    "Hours.AmericansFRD"),
  pos_contact = c("Pos.Cont.Euro", "Pos.Cont.Maori",
                  "Pos.Cont.Pacific", "Pos.Cont.Asian"),
  neg_contact = c("Neg.Cont.Euro", "Neg.Cont.Maori",
                  "Neg.Cont.Pacific", "Neg.Cont.Asian"),
  anxiety = c("Anx.NZEuro", "Anx.Maori", "Anx.Pacific", "Anx.Asian"),
  threat_sym = c("SymThrtNZE", "SymThrtMaori",
                 "SymThrtPacific", "SymThrtAsian"),
  threat_res = c("ResThrtNZE", "ResThrtMaori",
                 "ResThrtPacific", "ResThrtAsian"),

  # Colonial-legacy / Treaty
  hist_neg = c("HistNeg01", "HistNeg02", "HistNeg03"),
  sym_excl = c("SymbExcl01r", "SymbExcl02", "SymbExcl03"),
  # NZAVS has the typo `Discriminaton` in some waves
  modern_racism = c("DenialDiscrimination", "DenialDiscriminaton",
                    "Modern.Racism"),

  # Bicultural policy items
  policy_bi_resource = c("Issue.ResPolOp01r", "Issue.ResPolOp02r",
                         "Issue.ResPolOp03r", "Issue.ResPolOp04"),
  policy_bi_symbolic = c("Issue.SymPolOp01r", "Issue.SymPolOp02r",
                         "Issue.SymPolOp03r", "Issue.SymPolOp04r"),
  policy_bi_other = c("Issue.MaoriTV",
                      "Issue.Maori.Political.Power",
                      "Issue.ProtestMarchesMaori"),

  # Immigration policy
  policy_imm = c("Issue.China.Immigration", "Issue.India.Immigration",
                 "Issue.Foreign.Farm", "Issue.Foreign.Residential",
                 "Immigration.English", "Immigration.nonEnglish",
                 "Immigration.Language", "Immigration.Settlement",
                 "Multicultural.Diversity"),

  multicult = c("Multiculturalism01r", "Multiculturalism02",
                "Multiculturalism03", "Multiculturalism03r"),

  national_id = c("National.Identity", "NationalIdentityThreat",
                  "National.IdentityThreat",
                  "Patriotism01", "Patriotism02"),

  # NatChar civic-vs-ethnic — try several name variants the dictionary lists
  natchar = c("NatChar.Citizen", "NatChar.English", "NatChar.Laws",
              "NatChar.Ancestry", "NatChar.Rugby", "NatChar.MaoriCulture",
              "NatChar.Equality", "NatChar.CleanGreen",
              "TrueNZ.Citizen", "TrueNZ.English", "TrueNZ.Laws",
              "TrueNZ.Ancestry"),

  reo = c("TeReo.Understand", "TeReo.Speak", "TeReo.Use",
          "TeReo.Fluency", "TeReo.Acceptance"),

  # Māori subsample sociopolitical consciousness (incl. "I'm sick of hearing
  # about the Treaty of Waitangi…")
  maori_spc = paste0("Maori.SPC0", 1:8),

  # Pacific subsample wellbeing in NZ
  pacific_wbs = paste0("Pacific.WBS0", 1:7),

  # Subjective wellbeing — life satisfaction (1–7) and Kessler distress
  # (0–4 per item; full battery sums to a 0–24 scale).
  wellbeing  = c("SWB.LifeSat01", "SWB.LifeSat02",
                 "LifeMeaning01", "LifeMeaning02",
                 "SWB.Kessler01", "SWB.Kessler02", "SWB.Kessler03",
                 "SWB.Kessler04", "SWB.Kessler05", "SWB.Kessler06",
                 "Emp.JobSat")
)

# Demographic / cut variables to pull per wave when present
DEMO_STEMS <- c(
  "EthnicCats", "EthCat", "Ethnic.Cats",
  "MaoriAncestry", "BornNZ", "Census.Born.L1", "Citizen",
  "Age", "Cohort", "Gender", "GenderAll",
  "Census.MotherBorn.L1", "Census.FatherBorn.L1",
  "Immigrant.TimeNZYears", "SampleFrame",
  # Geographic cuts — territorial authority and Stats NZ's urban tier
  "TA_2023", "TA_2010", "Rural_GCH"
)

# ---- Geographic groupings ---------------------------------------------
#
# Old-goldfields TAs, by region. TA_2023 levels come through haven as the
# factor labels printed below. Dunedin City is the metro the rush built
# (we include it as a baseline reference but not in the goldfield bucket).
GOLDFIELDS <- list(
  goldfields_otago = c("Queenstown-Lakes District", "Central Otago District",
                       "Clutha District", "Waitaki District"),
  goldfields_west_coast = c("Buller District", "Grey District",
                            "Westland District"),
  goldfields_coromandel = c("Thames-Coromandel District", "Hauraki District")
)
GOLDFIELDS_ALL <- unname(unlist(GOLDFIELDS))

# Per-TA breakouts (for "best off vs worst off within the goldfields"
# comparisons). Same names as factor levels.
TA_BREAKOUTS <- c(GOLDFIELDS_ALL, "Auckland", "Dunedin City",
                  "Christchurch City", "Wellington City")

# Rural_GCH groupings. Three urban tiers + a combined "rural" bucket
# pooling Low + Remote + Very Remote for sample-size reasons.
URB_HIGH    <- "High Urban Accessibility"
URB_MEDIUM  <- "Medium Urban Accessibility"
URB_LOW     <- c("Low Urban Accessibility", "Remote", "Very Remote")
URB_ANY     <- c(URB_HIGH, URB_MEDIUM, URB_LOW)

# Items where a Likert "agree" cut makes sense (≥5 on 1–7 scale).
# Threat / anxiety are negative; warmth + hours not Likert in the same sense.
AGREE_FAMILIES <- c("hist_neg", "sym_excl", "modern_racism",
                    "policy_bi_resource", "policy_bi_symbolic",
                    "policy_bi_other", "policy_imm", "multicult",
                    "national_id", "natchar", "maori_spc", "pacific_wbs",
                    "threat_sym", "threat_res")

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

# Long frame: one row per (wave, item, group)
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
  # Coerce labelled → numeric for analysis items
  for (cc in wanted) d[[cc]] <- as.numeric(d[[cc]])

  # Ethnicity column for this wave
  eth_col <- intersect(
    c(paste0("EthnicCats.", suf), paste0("EthCat.", suf),
      paste0("Ethnic.Cats.", suf)),
    names(d)
  )
  eth <- if (length(eth_col) > 0) as.integer(d[[eth_col[1]]]) else
                                  rep(NA_integer_, nrow(d))

  # Geographic decode: TA_2023 / Rural_GCH as factor labels
  ta_col  <- intersect(paste0("TA_2023.", suf),   names(d))
  gch_col <- intersect(paste0("Rural_GCH.", suf), names(d))
  ta  <- if (length(ta_col)  > 0) as.character(as_factor(d[[ta_col[1]]]))
         else rep(NA_character_, nrow(d))
  gch <- if (length(gch_col) > 0) as.character(as_factor(d[[gch_col[1]]]))
         else rep(NA_character_, nrow(d))

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
    nzeur_rural  = which(eth == 1 & gch %in% URB_LOW),
    # Goldfield regions (pooled across the relevant TAs)
    goldfields_otago      = which(ta %in% GOLDFIELDS$goldfields_otago),
    goldfields_west_coast = which(ta %in% GOLDFIELDS$goldfields_west_coast),
    goldfields_coromandel = which(ta %in% GOLDFIELDS$goldfields_coromandel),
    goldfields_all        = which(ta %in% GOLDFIELDS_ALL),
    # Auckland baseline for goldfields comparison
    auckland = which(ta == "Auckland")
  )
  # Per-TA breakouts (one row per TA in TA_BREAKOUTS)
  for (this_ta in TA_BREAKOUTS) {
    key <- paste0("ta_", tolower(gsub("[^A-Za-z0-9]+", "_", this_ta)))
    groups[[key]] <- which(ta == this_ta)
  }

  summarise_item <- function(values, group_idx, group_label) {
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
      pct_agree = mean(v >= 5)
    )
  }

  for (col in wanted) {
    fam <- found_map[[col]]$family
    stem <- found_map[[col]]$stem
    vals <- d[[col]]

    rows <- list()
    for (g_name in names(groups)) {
      rows[[length(rows) + 1]] <- summarise_item(vals, groups[[g_name]],
                                                  g_name)
    }
    # Outgroup-only (excluding the target group, per paper2 convention)
    tgt <- NA_integer_
    if (grepl("Maori$|MaoriFRD$|Maori\\.|Maori$", stem)) tgt <- 2
    if (grepl("Pacific$|PacificFRD$", stem))            tgt <- 3
    if (grepl("Asian$|Asians$|AsiansFRD$|Chinese|Indians", stem)) tgt <- 4
    if (grepl("NZEuro|^Warm\\.NZEuro|NZEuroFRD|^SymThrtNZE|^ResThrtNZE", stem))
      tgt <- 1
    if (!is.na(tgt)) {
      rows[[length(rows) + 1]] <- summarise_item(vals, which(eth != tgt),
                                                  "outgroup")
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

# Add calendar year + agreement-only-where-meaningful flag
out$year <- WAVE_YEAR[out$wave]
out$pct_agree[!(out$family %in% AGREE_FAMILIES)] <- NA_real_

# Reorder columns
out <- out[, c("wave", "year", "family", "item", "group",
               "mean", "sd", "n", "pct_agree")]

# ---- Write outputs -----------------------------------------------------

write.csv(out, file.path(OUT_DIR, "atlas_stats_long.csv"),
          row.names = FALSE)

# Compact JSON: item-keyed at the top, with `family` + per-group series.
#
#   { "HistNeg01": { "family": "hist_neg",
#                    "groups": { "all": [{"wave":"T01","year":2009,...}, ...],
#                                "nz_european": [...], ... } },
#     "Warm.Muslims": { ... }, ... }
#
# Built imperatively because nested setNames inside dplyr summarise mangles
# the names on round-trip through tibble columns.

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
