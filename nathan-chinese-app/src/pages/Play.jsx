import { getRedirectResult } from "firebase/auth";
import { auth } from "../firebase";

const PlayPage = () => {
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log("User Info:", result.user);
          // You can also get Google Access Token if needed:
          // const credential = GoogleAuthProvider.credentialFromResult(result);
          // const token = credential?.accessToken;
        }
      })
      .catch((err) => {
        console.error("Redirect error:", err);
      });
  }, []);
  return <div></div>;
};

export default PlayPage;
