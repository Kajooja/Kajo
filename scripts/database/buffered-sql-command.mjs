// Consume all SQL before starting psql. Otherwise an early ON_ERROR_STOP exit
// can close Docker stdin while Node is still writing a large script (EPIPE),
// hiding the real SQL error. Only the fixed shell program is executed; SQL bytes
// are written to a private temporary file and are never evaluated by the shell.
export function bufferedSqlCommand(command) {
  return ['sh', '-c', `set -eu
kajo_query_file=$(mktemp /tmp/kajo-sql.XXXXXX)
trap 'rm -f "$kajo_query_file"' EXIT
cat > "$kajo_query_file"
"$@" --file="$kajo_query_file"`, 'kajo-sql', ...command];
}
