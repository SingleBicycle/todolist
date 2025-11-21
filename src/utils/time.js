const formatRelativeTime = (timestamp) => {
  if (!timestamp) return "Never";

  const now = Date.now();
  const then = timestamp * 1000;
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  // Fall back to date format for older timestamps
  const date = new Date(then);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};
function formatDate(timestamp) {
  const date = new Date(timestamp * 1000);

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  // Extract timezone abbreviation (e.g., PST, EST)
  const tz = date
    .toLocaleTimeString("en-us", { timeZoneName: "short" })
    .split(" ")
    .pop();

  return `${month} ${day} ${year} ${tz}`;
}

export { formatRelativeTime, formatDate };
