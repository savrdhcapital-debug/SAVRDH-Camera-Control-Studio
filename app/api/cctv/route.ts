const reply = () => Response.json({ message: "Local CCTV connections require the installed SAVRDH Camera Studio Mac app." }, { status: 409 });
export { reply as GET, reply as POST };
