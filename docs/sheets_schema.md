## Schema Specification

This is the schema specification for google sheets used by this updater

### Sheets

One Sheet per season of anime (ex. WINTER 2017, SPRING 2018).

These sheets must be named with SPRING, SUMMER, FALL, WINTER in caps followed by the four digit year.

### Headers

All sheets must start with a header row.

### Record Rows

Each row of votes will specify a single show. The first column must be the show name. This name MUST match exactly the show name as displayed on My Anime List. This is to make it easier to identify the show in the MAL Api.

Each following cells will be ordered results for each week of the seasons (starting from Week 1 and up) repeat as needed (though most common there will be less than 6 weeks of votes)

#### Cell Format

A record cell will be of the form: "Ep. 5: 2 to 4". This specifies the episode watched, and the votes for and against the show.
The background color will also be green if the show passed, and red indicating a loss.

The episode number must be the episode with in the season (to match the record on MAL) (See Boku no Hero S3 for a possible exception)

Cells can be filled with BYE (with green background) if the show is still active, but was not watched that week.

All other cells must be empty.
