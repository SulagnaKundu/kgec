"use server";
import { prisma } from "@/db/connectDb";
import { v4 as uuidv4 } from "uuid";
import RedisClient from "@/db/connectCache";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { sendJoinDiscussionMessage } from "@/lib/functions";

export async function startDiscussion(
  discussionName: string,
  classroomId: string,
) {
  const session = await auth();
  if (!session || !session.user) {
    redirect("/login");
  }

  const userId = session?.user?.id;
  const info = await prisma.enrollment.findFirst({
    where: {
      userId: userId,
      classroomId: classroomId,
    },
    select: {
      role: true,
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!info) {
    console.error("can not find entry in db");
    return { success: false, message: "you're not enrolled" };
  }

  const userRole = info?.role;
  const userEmail = session?.user?.email;
  const userName = info?.user.name;

  // generate a session id
  const sessionId = uuidv4();
  console.log(sessionId);

  // store the sesssion info in redis
  const client = await RedisClient.getInstance();
  const cacheRes = await client?.hSet(`session:${sessionId}`, {
    discussionName: discussionName,
    classroomId: classroomId,
    userId: userId as string,
    role: userRole as string,
    email: userEmail as string,
    permission: "Nil",
  });
  if (!cacheRes || cacheRes <= 0) {
    console.error("error adding to redis");
    return { success: false, message: "unable to add session on redis" };
  }

  try {
    const fetchRes = await fetch(`${process.env.BLUME_CHAT_URL_HTTP}/create`, {
      method: "POST",
      headers: {
        authorization: sessionId,
      },
    });

    if (!fetchRes.ok) {
      throw new Error("fetch failed with status" + fetchRes.status);
    }

    const data = await fetchRes.json();
    console.log(data);
    if (!data.success) {
      console.log("no its not a success");
      return {
        success: false,
        message: "got error from chat backend see logs",
      };
    }

    const ws = new WebSocket(process.env.BLUME_CHAT_URL_WS as string);
    if (ws.readyState === WebSocket.OPEN) {
      sendJoinDiscussionMessage(
        ws,
        userId as string,
        data.message,
        userName as string,
      );
    }
    console.log(data.message);
  } catch (err) {
    console.error("unable to fetch info from server", err);
    return {
      success: false,
      message:
        "either error on chat http endpoint or error connecting with websocket",
    };
  }

  return { success: true, message: "you are connected" };
}